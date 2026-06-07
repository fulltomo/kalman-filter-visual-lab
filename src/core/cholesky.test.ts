import { describe, it, expect } from 'vitest';
import { fromRows, mul, transpose, choleskyFactor, choleskySolve } from './linalg';

describe('choleskyFactor', () => {
  it('factors a known positive-definite matrix (A = L Lᵀ)', () => {
    const a = fromRows([[4, 2], [2, 3]]);
    const L = choleskyFactor(a);
    expect(L).not.toBeNull();
    expect(Array.from(L!.data)).toEqual([2, 0, 1, Math.sqrt(2)]);
    // reconstruct
    const recon = mul(L!, transpose(L!));
    expect(recon.data[0]).toBeCloseTo(4, 12);
    expect(recon.data[3]).toBeCloseTo(3, 12);
  });

  it('returns null for a non-positive-definite matrix', () => {
    expect(choleskyFactor(fromRows([[1, 2], [2, 1]]))).toBeNull();
  });
});

describe('choleskySolve', () => {
  it('solves A X = B for a positive-definite A', () => {
    const a = fromRows([[4, 2], [2, 3]]);
    const b = fromRows([[1], [1]]);
    const { x, jitterApplied } = choleskySolve(a, b);
    expect(jitterApplied).toBe(false);
    const recon = mul(a, x);
    expect(recon.data[0]).toBeCloseTo(1, 10);
    expect(recon.data[1]).toBeCloseTo(1, 10);
  });

  it('applies relative jitter and still returns a finite solution for a singular A', () => {
    const a = fromRows([[0, 0], [0, 0]]);
    const b = fromRows([[1], [1]]);
    const { x, jitterApplied } = choleskySolve(a, b);
    expect(jitterApplied).toBe(true);
    expect(Number.isFinite(x.data[0])).toBe(true);
    expect(Number.isFinite(x.data[1])).toBe(true);
  });
});
