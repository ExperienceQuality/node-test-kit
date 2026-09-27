import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('create-cy-platform CLI', () => {
  it('parses mode, target, and options', () => {
    const parsed = parseArgs(['brownfield', '.', '--dry-run', '--force', '--install']);
    expect(parsed.mode).toBe('brownfield');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.install).toBe(true);
  });
  it('rejects unsupported mode', () => {
    expect(() => parseArgs(['other', '.'])).toThrow('mode must be greenfield or brownfield');
  });
});
