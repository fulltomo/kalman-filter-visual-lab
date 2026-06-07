import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../types';
import { buildExperiment } from '../experiment';
import { makeEkf } from './ekf';
import { transpose, sub as matSub } from '../linalg';

function frob(data: Float64Array): number {
  let s = 0;
  for (const v of data) s += v * v;
  return Math.sqrt(s);
}

describe('makeEkf', () => {
  it('emits the §6.1 sub-steps in order on the first cycle', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 10, maxCycles: 3 });
    const ekf = makeEkf(exp, exp.config);
    const out = ekf.step(1, 'frames');
    expect(out.status).toBe('ok');
    expect(out.frames.map((f) => f.stepId)).toEqual([
      'ekf.forecast.state',
      'ekf.forecast.tlm',
      'ekf.forecast.cov',
      'ekf.analysis.innov',
      'ekf.analysis.innovCov',
      'ekf.analysis.gain',
      'ekf.analysis.mean',
      'ekf.analysis.cov',
    ]);
    expect(out.frames.every((f) => f.index === out.frames.indexOf(f))).toBe(true);
  });

  it('produces a symmetric analysis covariance', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 8, maxCycles: 2 });
    const ekf = makeEkf(exp, exp.config);
    const out = ekf.step(1, 'frames');
    const cov = out.frames.find((f) => f.stepId === 'ekf.analysis.cov')!.snapshot[0];
    const asMat = { rows: cov.rows, cols: cov.cols, data: cov.data };
    const asym = frob(matSub(asMat, transpose(asMat)).data);
    expect(asym).toBeLessThan(1e-10);
  });

  it('analysis reduces uncertainty (trace P^a <= trace P^f)', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 10, coverage: 'all', maxCycles: 2 });
    const ekf = makeEkf(exp, exp.config);
    const out = ekf.step(1, 'frames');
    const trace = (role: string) => {
      const q = out.frames.flatMap((f) => f.snapshot).find((s) => s.role === role)!;
      let t = 0;
      for (let i = 0; i < q.rows; i++) t += q.data[i * q.cols + i];
      return t;
    };
    expect(trace('P_a')).toBeLessThanOrEqual(trace('P_f') + 1e-9);
  });

  it('innovation equals y - H x^f', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 8, coverage: 'all', maxCycles: 2 });
    const ekf = makeEkf(exp, exp.config);
    const out = ekf.step(1, 'frames');
    const innovFrame = out.frames.find((f) => f.stepId === 'ekf.analysis.innov')!;
    const d = innovFrame.snapshot.find((s) => s.role === 'innovation')!;
    const xf = out.frames
      .find((f) => f.stepId === 'ekf.forecast.state')!
      .snapshot.find((s) => s.role === 'x_f')!;
    const y = exp.observation(1);
    for (let r = 0; r < exp.m; r++) {
      const expected = y[r] - xf.data[exp.obsIndices[r]];
      expect(d.data[r]).toBeCloseTo(expected, 10);
    }
  });

  it('diagnosticsOnly produces no frames but a finite diag', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 8, maxCycles: 2 });
    const ekf = makeEkf(exp, exp.config);
    const out = ekf.step(1, 'diagnosticsOnly');
    expect(out.frames).toEqual([]);
    expect(Number.isFinite(out.diag.rmseAnalysis)).toBe(true);
    expect(Number.isFinite(out.diag.spread)).toBe(true);
  });

  it('reduces analysis RMSE over a spin-up (filter actually works)', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 20, coverage: 'all', maxCycles: 40 });
    const ekf = makeEkf(exp, exp.config);
    const rmse: number[] = [];
    for (let c = 1; c <= 40; c++) rmse.push(ekf.step(c, 'diagnosticsOnly').diag.rmseAnalysis);
    const early = rmse.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const late = rmse.slice(-5).reduce((a, b) => a + b, 0) / 5;
    expect(late).toBeLessThan(early);
  });

  it('reset restores the initial background', () => {
    const exp = buildExperiment({ ...defaultConfig(), N: 8, maxCycles: 3 });
    const ekf = makeEkf(exp, exp.config);
    const first = ekf.step(1, 'diagnosticsOnly').diag.rmseAnalysis;
    ekf.step(2, 'diagnosticsOnly');
    ekf.reset();
    const again = ekf.step(1, 'diagnosticsOnly').diag.rmseAnalysis;
    expect(again).toBeCloseTo(first, 12);
  });
});
