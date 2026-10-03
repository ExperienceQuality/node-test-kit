import type { IncomingMessage } from 'node:http';
import pactum from 'pactum';
import type { DataTable } from '@cucumber/cucumber';
import type { PactumSpec } from '@xq/rest-client';
import { composeJsonTable } from './json.js';

export type JsonTableMode = 'exact' | 'contains';

export interface JsonTableExpectationOptions {
  readonly mode?: JsonTableMode;
  /** Read and compare only this dotted/indexed JSON path. */
  readonly path?: string;
}

/** Public response value returned by awaiting a Pactum spec (or calling toss()). */
export type JsonTableResponse = IncomingMessage & { readonly json?: unknown };

interface JsonTableExpectationData {
  readonly expected: JsonValue;
  readonly mode: JsonTableMode;
  readonly path?: string;
}

interface PactumResponseContext {
  readonly res: { readonly json?: unknown; readonly headers?: Record<string, string | string[] | undefined> };
  readonly data?: JsonTableExpectationData;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonPathPart = string | number;

const HANDLER_NAME = 'xq-json-table';
const { handler } = pactum;
let registered = false;

/** Register the process-wide Pactum handler once; safe to call from multiple bootstrap imports. */
export function registerJsonTableExpectation(): void {
  if (registered) return;
  handler.addExpectHandler(HANDLER_NAME, evaluateExpectation);
  registered = true;
}

/** Attach a response-table expectation to a pending Pactum request. Returns the same request spec. */
export function expectJsonTable(
  spec: PactumSpec,
  table: DataTable,
  options: JsonTableExpectationOptions = {}
): PactumSpec {
  const data = expectationData(table, options);
  return spec.inspect(false).expect(HANDLER_NAME, data);
}

/** Assert a previously executed request response. Does not issue or retry a request. */
export async function assertJsonTable(
  response: JsonTableResponse,
  table: DataTable,
  options: JsonTableExpectationOptions = {}
): Promise<void> {
  const data = expectationData(table, options);
  if (!response || typeof response !== 'object') {
    throw new Error('xq-test: cannot assert JSON table without an executed response');
  }
  // Passing no spec to Pactum's public response assertion prevents its default failure logger
  // from printing request/response bodies; diagnostics remain limited to paths and types.
  await pactum.expect(response).to.have._(HANDLER_NAME, data);
}

function evaluateExpectation({ res, data }: PactumResponseContext): void {
  if (!data || (data.mode !== 'exact' && data.mode !== 'contains')) {
    throw new Error('xq-test: JSON table expectation configuration is invalid');
  }
  const contentType = res.headers?.['content-type'];
  const mediaType = Array.isArray(contentType) ? contentType[0] : contentType;
  if (res.json === undefined || !mediaType?.split(';', 1)[0]?.trim().toLowerCase().match(/^[^/]+\/(?:json|[^/;]+\+json)$/)) {
    throw new Error('xq-test: response is not valid JSON');
  }
  const actual = data.path === undefined ? res.json : readJsonPath(res.json, data.path);
  compareJson(actual, data.expected, data.mode, data.path ?? '$');
}

function expectationData(table: DataTable, options: JsonTableExpectationOptions): JsonTableExpectationData {
  const mode = options.mode ?? 'exact';
  if (mode !== 'exact' && mode !== 'contains') throw new Error('xq-test: JSON table mode must be exact or contains');
  if (options.path !== undefined) parseJsonPath(options.path);
  return {
    expected: composeJsonTable(table),
    mode,
    ...(options.path === undefined ? {} : { path: options.path })
  };
}

function compareJson(actual: unknown, expected: JsonValue, mode: JsonTableMode, path: string): void {
  if (!matchesJson(actual, expected, mode)) mismatch(path, expected, actual, mode);
}

function matchesJson(actual: unknown, expected: JsonValue, mode: JsonTableMode): boolean {
  if (mode === 'contains' && isRecord(expected)) {
    return isRecord(actual) && Object.entries(expected).every(([key, value]) =>
      Object.hasOwn(actual, key) && matchesJson(actual[key], value, mode)
    );
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (mode === 'exact') {
      return actual.length === expected.length && expected.every((value, index) => matchesJson(actual[index], value, mode));
    }
    if (expected.length > actual.length) return false;
    const matchedExpectedByActual = new Array<number>(actual.length).fill(-1);
    const assign = (expectedIndex: number, visited: Set<number>): boolean => {
      for (let actualIndex = 0; actualIndex < actual.length; actualIndex += 1) {
        if (visited.has(actualIndex) || !matchesJson(actual[actualIndex], expected[expectedIndex]!, mode)) continue;
        visited.add(actualIndex);
        if (matchedExpectedByActual[actualIndex] === -1 || assign(matchedExpectedByActual[actualIndex]!, visited)) {
          matchedExpectedByActual[actualIndex] = expectedIndex;
          return true;
        }
      }
      return false;
    };
    return expected.every((_value, index) => assign(index, new Set()));
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false;
    const expectedKeys = Object.keys(expected);
    if (mode === 'exact') {
      const actualKeys = Object.keys(actual);
      if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key) => !Object.hasOwn(actual, key))) return false;
    }
    return expectedKeys.every((key) => Object.hasOwn(actual, key) && matchesJson(actual[key], expected[key]!, mode));
  }
  return actual === expected;
}

function readJsonPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of parseJsonPath(path)) {
    if (typeof part === 'number') {
      if (!Array.isArray(current) || !(part in current)) throw new Error(`xq-test: response JSON path "${path}" was not found`);
      current = current[part];
    } else {
      if (!isRecord(current) || !Object.hasOwn(current, part)) throw new Error(`xq-test: response JSON path "${path}" was not found`);
      current = current[part];
    }
  }
  return current;
}

function parseJsonPath(path: string): JsonPathPart[] {
  if (path === '$') return [];
  if (path.startsWith('$.')) path = path.slice(2);
  else if (path.startsWith('$[')) path = path.slice(1);
  const parts: JsonPathPart[] = [];
  let offset = 0;
  while (offset < path.length) {
    const start = offset;
    while (offset < path.length && path[offset] !== '.' && path[offset] !== '[' && path[offset] !== ']') offset += 1;
    if (start !== offset) parts.push(path.slice(start, offset));
    else if (path[offset] !== '[') throw new Error(`xq-test: invalid response JSON path "${path}"`);
    while (path[offset] === '[') {
      const close = path.indexOf(']', offset + 1);
      if (close < 0) throw new Error(`xq-test: invalid response JSON path "${path}"`);
      const indexText = path.slice(offset + 1, close);
      if (!/^(0|[1-9]\d*)$/.test(indexText) || !Number.isSafeInteger(Number(indexText))) {
        throw new Error(`xq-test: invalid response JSON path "${path}"`);
      }
      parts.push(Number(indexText));
      offset = close + 1;
    }
    if (offset < path.length) {
      if (path[offset] !== '.' || offset === path.length - 1) throw new Error(`xq-test: invalid response JSON path "${path}"`);
      offset += 1;
    }
  }
  if (parts.length === 0) throw new Error('xq-test: response JSON path must not be blank');
  return parts;
}

function mismatch(path: string, expected: unknown, actual: unknown, mode: JsonTableMode): never {
  throw new Error(`xq-test: JSON ${mode} assertion failed at ${path} (expected ${valueType(expected)}, received ${valueType(actual)})`);
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'undefined') return 'missing';
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
