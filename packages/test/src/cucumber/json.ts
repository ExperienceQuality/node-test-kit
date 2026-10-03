import type { DataTable } from '@cucumber/cucumber';

type PathPart = { readonly kind: 'key'; readonly value: string } | { readonly kind: 'index'; readonly value: number };
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type TableLocation = { readonly row: number; readonly column: number } | { readonly headerColumn: number };

/** Compose one object or multiple row objects from dotted/indexed DataTable headers. */
export function composeJsonTable(table: DataTable): JsonValue {
  const rows = table.raw();
  const headers = rows[0];
  if (!headers?.length) throw new Error('xq-test: JSON table must have at least one header column');

  const columns = headers.map((header, index) => {
    const headerColumn = index + 1;
    const path = header.trim();
    if (!path) throw headerError(headerColumn, 'header path must not be blank');
    return { path, parts: parsePath(path, { headerColumn }) };
  });
  validateHeaders(columns);
  if (rows.length < 2) throw new Error('xq-test: JSON table must contain at least one data row');

  const objects: Record<string, JsonValue>[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1;
    if (!row || row.length !== columns.length) {
      throw tableError(rowNumber, Math.min((row?.length ?? 0) + 1, columns.length), `expected ${columns.length} cells`);
    }
    const object: Record<string, JsonValue> = {};
    const arrayRowByIndex = new WeakMap<JsonValue[], Map<number, { row: number; column: number }>>();
    columns.forEach((column, index) => {
      const columnNumber = index + 1;
      const rawValue = row[index] ?? '';
      if (!rawValue.trim()) throw tableError(rowNumber, columnNumber, 'value must not be blank');
      const value = parseValue(rawValue.trim());
      assignPath(object, column.parts, value, { row: rowNumber, column: columnNumber }, column.path, arrayRowByIndex);
    });
    validateDenseArrays(object, arrayRowByIndex);
    objects.push(object);
  }
  return objects.length === 1 ? objects[0]! : objects;
}

function parseValue(value: string): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return value;
  }
}

function validateHeaders(columns: readonly { path: string; parts: PathPart[] }[]): void {
  for (let index = 0; index < columns.length; index += 1) {
    const current = columns[index]!;
    for (let previous = 0; previous < index; previous += 1) {
      const prior = columns[previous]!;
      if (samePath(prior.parts, current.parts)) {
        throw headerError(index + 1, `duplicate path "${current.path}" (same as header column ${previous + 1})`);
      }
      const conflict = headerConflict(prior.parts, current.parts);
      if (conflict) {
        throw headerError(index + 1, `path "${current.path}" conflicts with header column ${previous + 1} ("${prior.path}")`);
      }
    }
  }
}

function samePath(left: readonly PathPart[], right: readonly PathPart[]): boolean {
  return left.length === right.length && left.every((part, index) => samePart(part, right[index]!));
}

function headerConflict(left: readonly PathPart[], right: readonly PathPart[]): boolean {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftPart = left[index]!;
    const rightPart = right[index]!;
    if (samePart(leftPart, rightPart)) continue;
    return leftPart.kind !== rightPart.kind;
  }
  return left.length !== right.length;
}

function samePart(left: PathPart, right: PathPart): boolean {
  return left.kind === right.kind && left.value === right.value;
}

function parsePath(path: string, location: TableLocation): PathPart[] {
  const parts: PathPart[] = [];
  let offset = 0;
  while (offset < path.length) {
    const start = offset;
    while (offset < path.length && path[offset] !== '.' && path[offset] !== '[' && path[offset] !== ']') offset += 1;
    const key = path.slice(start, offset);
    if (!key) throw locationError(location, `invalid path "${path}"`);
    if (key.includes('.') || key.includes('[') || key.includes(']')) {
      throw locationError(location, 'keys containing ., [ or ] are not supported');
    }
    parts.push({ kind: 'key', value: key });
    while (path[offset] === '[') {
      const close = path.indexOf(']', offset + 1);
      if (close === -1) throw locationError(location, `invalid array index in path "${path}"`);
      const indexText = path.slice(offset + 1, close);
      if (!/^(0|[1-9]\d*)$/.test(indexText)) throw locationError(location, `invalid array index in path "${path}"`);
      const index = Number(indexText);
      if (!Number.isSafeInteger(index)) throw locationError(location, `invalid array index in path "${path}"`);
      parts.push({ kind: 'index', value: index });
      offset = close + 1;
    }
    if (offset < path.length) {
      if (path[offset] !== '.' || offset === path.length - 1) throw locationError(location, `invalid path "${path}"`);
      offset += 1;
      if (offset === path.length) throw locationError(location, `invalid path "${path}"`);
    }
  }
  if (parts[0]?.kind !== 'key') throw locationError(location, `invalid path "${path}"`);
  return parts;
}

function assignPath(
  root: Record<string, JsonValue>,
  parts: readonly PathPart[],
  value: JsonValue,
  location: TableLocation,
  sourcePath: string,
  arrayRowByIndex: WeakMap<JsonValue[], Map<number, { row: number; column: number }>>
): void {
  let current: Record<string, JsonValue> | JsonValue[] = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];
    if (!part) throw locationError(location, `invalid path "${sourcePath}"`);
    const isLeaf = index === parts.length - 1;
    if (part.kind === 'key') {
      if (!isRecord(current)) throw locationError(location, `path conflict at "${sourcePath}"`);
      if (isLeaf) {
        if (Object.hasOwn(current, part.value)) throw locationError(location, `path conflict at "${sourcePath}"`);
        defineJsonProperty(current, part.value, value);
        continue;
      }
      const existing: JsonValue | undefined = Object.hasOwn(current, part.value) ? current[part.value] : undefined;
      const expectedArray = next?.kind === 'index';
      if (existing === undefined) {
        const child: JsonValue[] | Record<string, JsonValue> = expectedArray ? [] : {};
        defineJsonProperty(current, part.value, child);
        current = child;
      } else if ((expectedArray && !Array.isArray(existing)) || (!expectedArray && !isRecord(existing))) {
        throw locationError(location, `path conflict at "${sourcePath}"`);
      } else {
        current = existing as Record<string, JsonValue> | JsonValue[];
      }
    } else {
      if (!Array.isArray(current)) throw locationError(location, `path conflict at "${sourcePath}"`);
      if (part.value > 100_000) throw locationError(location, 'array index exceeds 100000');
      if (isLeaf) {
        if (part.value in current) throw locationError(location, `path conflict at "${sourcePath}"`);
        current[part.value] = value;
        recordArrayIndex(arrayRowByIndex, current, part.value, location);
        continue;
      }
      const existing = current[part.value];
      const expectedArray = next?.kind === 'index';
      if (existing === undefined) {
        current[part.value] = expectedArray ? [] : {};
        recordArrayIndex(arrayRowByIndex, current, part.value, location);
      } else if ((expectedArray && !Array.isArray(existing)) || (!expectedArray && !isRecord(existing))) {
        throw locationError(location, `path conflict at "${sourcePath}"`);
      }
      current = current[part.value] as Record<string, JsonValue> | JsonValue[];
    }
  }
}

function validateDenseArrays(
  value: JsonValue,
  arrayRowByIndex: WeakMap<JsonValue[], Map<number, { row: number; column: number }>>
): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) {
        const rowByIndex = arrayRowByIndex.get(value);
        const laterIndex = [...(rowByIndex?.keys() ?? [])].filter((assignedIndex) => assignedIndex > index).sort((a, b) => a - b)[0];
        const location = laterIndex === undefined ? undefined : rowByIndex?.get(laterIndex);
        if (!location) throw new Error('xq-test: internal JSON table array row tracking invariant failed');
        throw tableError(location.row, location.column, 'sparse arrays are not supported');
      }
      validateDenseArrays(value[index]!, arrayRowByIndex);
    }
  } else if (isRecord(value)) {
    for (const child of Object.values(value)) validateDenseArrays(child, arrayRowByIndex);
  }
}

function recordArrayIndex(
  arrayRowByIndex: WeakMap<JsonValue[], Map<number, { row: number; column: number }>>,
  array: JsonValue[],
  index: number,
  location: TableLocation
): void {
  let rowByIndex = arrayRowByIndex.get(array);
  if (!rowByIndex) {
    rowByIndex = new Map();
    arrayRowByIndex.set(array, rowByIndex);
  }
  if ('row' in location) rowByIndex.set(index, location);
}

function defineJsonProperty(target: Record<string, JsonValue> | JsonValue[], key: string, value: JsonValue): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function locationError(location: TableLocation, message: string): Error {
  return 'row' in location
    ? tableError(location.row, location.column, message)
    : headerError(location.headerColumn, message);
}

function headerError(column: number, message: string): Error {
  return new Error(`xq-test: JSON table header column ${column}: ${message}`);
}

function tableError(row: number, column: number, message: string): Error {
  return new Error(`xq-test: JSON table row ${row}, column ${column}: ${message}`);
}
