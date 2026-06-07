import { describe, it, expect } from 'vitest';
import { percentileAbs, symLogNorm, divergingColor, NONFINITE_RGB } from './colorScale';

describe('percentileAbs', () => {
  it('returns a robust max ignoring a few outliers', () => {
    const data = Float64Array.from([...Array(100).keys()].map((i) => i / 100)); // 0..0.99
    data[99] = 1000; // outlier
    const p = percentileAbs(data, 0.98);
    expect(p).toBeGreaterThan(0.9);
    expect(p).toBeLessThan(1); // outlier excluded
  });

  it('ignores NaN/Inf', () => {
    const p = percentileAbs(Float64Array.from([1, 2, NaN, Infinity, 3]), 1);
    expect(p).toBe(3);
  });
});

describe('symLogNorm', () => {
  it('maps 0 to 0 and is sign-preserving and monotonic', () => {
    expect(symLogNorm(0, 100)).toBeCloseTo(0, 12);
    expect(symLogNorm(100, 100)).toBeCloseTo(1, 6);
    expect(symLogNorm(-100, 100)).toBeCloseTo(-1, 6);
    expect(symLogNorm(10, 100)).toBeGreaterThan(0);
    expect(symLogNorm(50, 100)).toBeGreaterThan(symLogNorm(10, 100));
  });

  it('clamps beyond the scale', () => {
    expect(symLogNorm(1e9, 100)).toBeLessThanOrEqual(1);
  });
});

describe('divergingColor', () => {
  it('returns the sentinel for non-finite input', () => {
    expect(divergingColor(NaN)).toEqual(NONFINITE_RGB);
  });

  it('returns three 0-255 channels', () => {
    const [r, g, b] = divergingColor(0.5);
    for (const ch of [r, g, b]) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(255);
    }
  });
});
