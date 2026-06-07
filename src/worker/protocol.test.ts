import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION, makeId } from './protocol';

describe('protocol', () => {
  it('exposes an integer protocol version', () => {
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('makeId returns unique strings', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => makeId()));
    expect(ids.size).toBe(1000);
  });
});
