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

  it('applies relative jitter for a large-scale near-singular matrix', () => {
    // Rank-1 (not PD) with diagonal ~1e4, so the RELATIVE jitter scale
    // tau = meanDiag dominates the absolute floor of 1 — exercises the
    // tau > floor branch that protects large-scale covariances.
    const a = fromRows([[1e4, 1e4], [1e4, 1e4]]);
    const b = fromRows([[1], [1]]);
    const { x, jitterApplied } = choleskySolve(a, b);
    expect(jitterApplied).toBe(true);
    expect(Number.isFinite(x.data[0])).toBe(true);
    expect(Number.isFinite(x.data[1])).toBe(true);
  });

  it('solves A X = B for multi-column B (B = I yields A⁻¹)', () => {
    const a = fromRows([[4, 2], [2, 3]]);
    const b = fromRows([[1, 0], [0, 1]]);
    const { x } = choleskySolve(a, b);
    const recon = mul(a, x); // A · A⁻¹ = I
    expect(recon.data[0]).toBeCloseTo(1, 10);
    expect(recon.data[1]).toBeCloseTo(0, 10);
    expect(recon.data[2]).toBeCloseTo(0, 10);
    expect(recon.data[3]).toBeCloseTo(1, 10);
  });

  it('throws when b has a different row count than a', () => {
    expect(() => choleskySolve(fromRows([[4, 2], [2, 3]]), fromRows([[1]]))).toThrow();
  });
});
