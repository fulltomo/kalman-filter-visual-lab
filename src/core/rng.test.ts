import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces uniform values in [0, 1)', () => {
    const r = makeRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different sequences', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
    expect(makeRng(1).gaussian()).not.toBe(makeRng(2).gaussian());
  });

  it('gaussian is deterministic for a given seed (exercises the spare cache)', () => {
    const a = makeRng(99);
    const b = makeRng(99);
    // Four draws hit both Box–Muller paths: the spare-generating call (1st, 3rd)
    // and the spare-consuming call (2nd, 4th).
    const seqA = [a.gaussian(), a.gaussian(), a.gaussian(), a.gaussian()];
    const seqB = [b.gaussian(), b.gaussian(), b.gaussian(), b.gaussian()];
    expect(seqA).toEqual(seqB);
  });

  it('gaussian has ~zero mean and ~unit variance', () => {
    const r = makeRng(7);
    const n = 100000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = r.gaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });
});
