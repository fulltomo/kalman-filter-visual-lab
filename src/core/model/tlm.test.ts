import { describe, it, expect } from 'vitest';
import { rk4Step, rk4StepTLM, integrate } from './lorenz96';
import { get } from '../linalg';
import { makeRng } from '../rng';

describe('rk4StepTLM', () => {
  it('advances the state identically to rk4Step', () => {
    const x = Float64Array.from([1, 2, 3, 4, 5]);
    const a = rk4Step(x, 8, 0.05);
    const b = rk4StepTLM(x, 8, 0.05).x;
    for (let i = 0; i < x.length; i++) expect(b[i]).toBeCloseTo(a[i], 12);
  });

  it('M matches a central finite-difference of one RK4 step', () => {
    const N = 6;
    const F = 8;
    const dt = 0.05;
    const r = makeRng(11);
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = r.gaussian() * 3;

    const { M } = rk4StepTLM(x, F, dt);
    const eps = 1e-6;
    for (let j = 0; j < N; j++) {
      const xp = x.slice();
      const xm = x.slice();
      xp[j] += eps;
      xm[j] -= eps;
      const fp = rk4Step(xp, F, dt);
      const fm = rk4Step(xm, F, dt);
      for (let i = 0; i < N; i++) {
        const fd = (fp[i] - fm[i]) / (2 * eps);
        expect(get(M, i, j)).toBeCloseTo(fd, 5);
      }
    }
  });

  it('composed TLM over S steps matches a finite-difference of integrate', () => {
    const N = 5;
    const F = 8;
    const dt = 0.05;
    const S = 5;
    const r = makeRng(21);
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = r.gaussian() * 2;

    // Compose M_total = M_S · … · M_1 along the trajectory.
    let cur: Float64Array = x.slice();
    const total = rk4StepTLM(cur, F, dt);
    cur = total.x;
    let M = total.M;
    for (let s = 1; s < S; s++) {
      const step = rk4StepTLM(cur, F, dt);
      M = matMul(step.M, M);
      cur = step.x;
    }

    const eps = 1e-6;
    for (let j = 0; j < N; j++) {
      const xp = x.slice();
      const xm = x.slice();
      xp[j] += eps;
      xm[j] -= eps;
      const fp = integrate(xp, F, dt, S);
      const fm = integrate(xm, F, dt, S);
      for (let i = 0; i < N; i++) {
        const fd = (fp[i] - fm[i]) / (2 * eps);
        expect(get(M, i, j)).toBeCloseTo(fd, 4);
      }
    }
  });
});

// local dense multiply to keep this test self-contained
function matMul(a: { rows: number; cols: number; data: Float64Array }, b: typeof a) {
  const m = { rows: a.rows, cols: b.cols, data: new Float64Array(a.rows * b.cols) };
  for (let i = 0; i < a.rows; i++)
    for (let k = 0; k < a.cols; k++) {
      const aik = a.data[i * a.cols + k];
      for (let j = 0; j < b.cols; j++) m.data[i * b.cols + j] += aik * b.data[k * b.cols + j];
    }
  return m;
}
