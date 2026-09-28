import type { RestArgs, RestCommandArgs } from './types.js';

const HTTP_METHODS = new Set([
  'CONNECT',
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'TRACE'
]);

function isHttpMethod(value: unknown): boolean {
  return typeof value === 'string' && HTTP_METHODS.has(value.toUpperCase());
}

function isUrl(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('/') || /^https?:\/\//i.test(value));
}

export function parseRestCommandArgs(args: RestCommandArgs): {
  alias: string | undefined;
  request: RestArgs;
} {
  const [first] = args;
  if (args.length === 4 || (typeof first === 'string' && !isHttpMethod(first) && !isUrl(first))) {
    return { alias: first as string, request: args.slice(1) as RestArgs };
  }

  return { alias: undefined, request: args as RestArgs };
}
