import { describe, it, expect } from 'vitest';
import { rhs, jacobian } from './lorenz96';
import { get } from '../linalg';
import { makeRng } from '../rng';

describe('lorenz96 jacobian', () => {
  it('matches a central finite-difference of rhs', () => {
    const N = 6;
    const F = 8;
    const r = makeRng(3);
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = r.gaussian() * 3;

    const J = jacobian(x);
    const eps = 1e-6;
    for (let j = 0; j < N; j++) {
      const xp = x.slice();
      const xm = x.slice();
      xp[j] += eps;
      xm[j] -= eps;
      const fp = rhs(xp, F);
      const fm = rhs(xm, F);
      for (let i = 0; i < N; i++) {
        const fd = (fp[i] - fm[i]) / (2 * eps);
        expect(get(J, i, j)).toBeCloseTo(fd, 5);
      }
    }
  });

  it('is square N×N', () => {
    const J = jacobian(new Float64Array(5).fill(1));
    expect(J.rows).toBe(5);
    expect(J.cols).toBe(5);
  });

  it('is independent of F (the +F term has zero derivative)', () => {
    const N = 6;
    const r = makeRng(99);
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = r.gaussian() * 3;

    const J = jacobian(x); // takes no F argument
    const eps = 1e-6;
    // Central FD of rhs at F = 0 must equal the (F-free) analytic Jacobian;
    // matching at F=0 here and at F=8 in the test above confirms F-independence.
    for (let j = 0; j < N; j++) {
      const xp = x.slice();
      const xm = x.slice();
      xp[j] += eps;
      xm[j] -= eps;
      const fp = rhs(xp, 0);
      const fm = rhs(xm, 0);
      for (let i = 0; i < N; i++) {
        expect(get(J, i, j)).toBeCloseTo((fp[i] - fm[i]) / (2 * eps), 5);
      }
    }
  });
});
