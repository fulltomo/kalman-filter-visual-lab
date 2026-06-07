import { describe, it, expect } from 'vitest';
import { rhs, rk4Step, integrate } from './lorenz96';

describe('lorenz96 rhs', () => {
  it('matches hand-computed derivatives for N=4', () => {
    // f_i = (x[i+1] - x[i-2]) * x[i-1] - x[i] + F, cyclic
    const x = Float64Array.from([1, 2, 3, 4]);
    const d = rhs(x, 8);
    expect(Array.from(d)).toEqual([3, 5, 11, 1]);
  });

  it('is zero at the fixed point x_i = F when F is constant in time (rhs at x=F·1)', () => {
    const N = 6;
    const F = 8;
    const x = new Float64Array(N).fill(F);
    const d = rhs(x, F);
    for (const v of d) expect(v).toBeCloseTo(0, 12);
  });

  it('writes into the provided out buffer and returns it', () => {
    const x = Float64Array.from([1, 2, 3, 4]);
    const out = new Float64Array(4);
    const ret = rhs(x, 8, out);
    expect(ret).toBe(out);
    expect(Array.from(out)).toEqual([3, 5, 11, 1]);
  });

  it('throws if the out buffer aliases x (cyclic stencil would self-corrupt)', () => {
    const x = Float64Array.from([1, 2, 3, 4]);
    expect(() => rhs(x, 8, x)).toThrow();
  });
});

describe('lorenz96 integrate', () => {
  it('stays finite and bounded over a long run', () => {
    const N = 8;
    const x0 = new Float64Array(N).fill(8);
    x0[0] += 0.01; // perturb off the fixed point
    const xT = integrate(x0, 8, 0.05, 2000);
    for (const v of xT) {
      expect(Number.isFinite(v)).toBe(true);
      // Lorenz96 with F=8 is bounded (empirical |x| rarely exceeds ~20);
      // 100 is a generous envelope that still catches blow-ups.
      expect(Math.abs(v)).toBeLessThan(100);
    }
  });

  it('rk4Step keeps the fixed point fixed', () => {
    const x = new Float64Array(5).fill(8);
    const next = rk4Step(x, 8, 0.05);
    for (const v of next) expect(v).toBeCloseTo(8, 10);
  });

  it('does not mutate the input array', () => {
    const x0 = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const orig = Array.from(x0);
    integrate(x0, 8, 0.05, 10);
    expect(Array.from(x0)).toEqual(orig);
  });

  it('rk4Step throws for N < 4 (Lorenz96 is undefined below 4 cells)', () => {
    expect(() => rk4Step(new Float64Array(3).fill(8), 8, 0.05)).toThrow();
  });
});
