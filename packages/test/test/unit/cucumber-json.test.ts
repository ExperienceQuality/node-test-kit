import { describe, expect, it } from 'vitest';
import { composeJsonTable } from '../../src/cucumber/json.js';

function table(rows: string[][]) {
  return { raw: () => rows } as never;
}

describe('composeJsonTable', () => {
  it('composes nested JSON from path headers and parses bare text as a string', () => {
    expect(composeJsonTable(table([
      ['customer.id', 'customer.profile.active', 'items[0].sku', 'items[0].quantity', 'metadata', 'note'],
      ['"cust-123"', 'true', '"SKU-1"', '2', '{"source":"e2e"}', 'priority customer']
    ]))).toEqual({
      customer: { id: 'cust-123', profile: { active: true } },
      items: [{ sku: 'SKU-1', quantity: 2 }],
      metadata: { source: 'e2e' },
      note: 'priority customer'
    });
  });

  it('returns one object per data row when table contains multiple rows', () => {
    expect(composeJsonTable(table([
      ['customer.id', 'customer.name', 'active'],
      ['"cust-1"', 'Ada', 'true'],
      ['"cust-2"', 'Grace Hopper', 'false']
    ]))).toEqual([
      { customer: { id: 'cust-1', name: 'Ada' }, active: true },
      { customer: { id: 'cust-2', name: 'Grace Hopper' }, active: false }
    ]);
  });

  it.each([
    { rows: [[]], message: 'at least one header column' },
    { rows: [['']], message: 'header column 1: header path must not be blank' },
    { rows: [['a']], message: 'at least one data row' },
    { rows: [['a', 'a'], ['1', '2']], message: 'header column 2: duplicate path "a"' },
    { rows: [['customer', 'customer.id'], ['{}', '"1"']], message: 'header column 2: path "customer.id" conflicts' },
    { rows: [['customer.id', 'customer[0].id'], ['"1"', '"2"']], message: 'header column 2: path "customer[0].id" conflicts' },
    { rows: [['items[1].sku'], ['"SKU-1"']], message: 'row 2, column 1: sparse arrays are not supported' },
    { rows: [['name', 'active'], ['Ada']], message: 'row 2, column 2: expected 2 cells' },
    { rows: [['name'], ['   ']], message: 'row 2, column 1: value must not be blank' },
    { rows: [['customer..id'], ['"1"']], message: 'header column 1: invalid path' }
  ])('rejects invalid table: $message', ({ rows, message }) => {
    expect(() => composeJsonTable(table(rows))).toThrow(message);
  });

  it('allows sibling nested paths and dense array columns in a row', () => {
    expect(composeJsonTable(table([
      ['items[1].sku', 'items[0].sku'],
      ['"SKU-2"', '"SKU-1"']
    ]))).toEqual({ items: [{ sku: 'SKU-1' }, { sku: 'SKU-2' }] });
  });
});
