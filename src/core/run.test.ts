import { describe, it, expect } from 'vitest';
import { defaultConfig, ConfigError } from './types';
import { DaRun } from './run';

describe('DaRun.configure', () => {
  it('returns dims, appliedConfig and no warnings for the defaults', () => {
    const run = new DaRun();
    const res = run.configure({ ...defaultConfig(), N: 40, coverage: 'sparse' });
    expect(res.dims).toEqual({ N: 40, k: 20, m: 20 });
    expect(res.appliedConfig.N).toBe(40);
    expect(res.warnings).toEqual([]);
  });

  it('throws ConfigError(invalidConfig) on a hard-invalid config', () => {
    const run = new DaRun();
    expect(() => run.configure({ ...defaultConfig(), N: 2 })).toThrow(ConfigError);
  });

  it('emits a heavyConfig warning for a red-tier config', () => {
    const run = new DaRun();
    const res = run.configure({ ...defaultConfig(), N: 128, maxCycles: 1000 });
    expect(res.warnings.some((w) => w.code === 'heavyConfig')).toBe(true);
  });
});

describe('DaRun.computeCycle', () => {
  it('advances cycles sequentially and returns frames', () => {
    const run = new DaRun();
    run.configure({ ...defaultConfig(), N: 10, maxCycles: 3 });
    const out = run.computeCycle(1, 'frames');
    expect(out.status).toBe('ok');
    expect(out.frames!.length).toBe(8);
    expect(Number.isFinite(out.diag.rmseAnalysis)).toBe(true);
  });

  it('rejects out-of-order cycles', () => {
    const run = new DaRun();
    run.configure({ ...defaultConfig(), N: 10, maxCycles: 3 });
    expect(() => run.computeCycle(2, 'frames')).toThrow();
  });

  it('omits frames for diagnosticsOnly', () => {
    const run = new DaRun();
    run.configure({ ...defaultConfig(), N: 10, maxCycles: 3 });
    const out = run.computeCycle(1, 'diagnosticsOnly');
    expect(out.frames).toBeUndefined();
    expect(Number.isFinite(out.diag.spread)).toBe(true);
  });

  it('reduces RMSE over a spin-up', () => {
    const run = new DaRun();
    run.configure({ ...defaultConfig(), N: 20, coverage: 'all', maxCycles: 40 });
    const rmse: number[] = [];
    for (let c = 1; c <= 40; c++) rmse.push(run.computeCycle(c, 'diagnosticsOnly').diag.rmseAnalysis);
    const early = rmse.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const late = rmse.slice(-5).reduce((a, b) => a + b, 0) / 5;
    expect(late).toBeLessThan(early);
  });

  it('stays finite at extreme parameters (k=100, dt=0.01, N=128)', () => {
    const run = new DaRun();
    run.configure({
      ...defaultConfig(),
      N: 128,
      k: 100,
      dt: 0.01,
      assimInterval: 0.05,
      maxCycles: 15,
    });
    for (let c = 1; c <= 15; c++) {
      const out = run.computeCycle(c, 'diagnosticsOnly');
      expect(out.status).toBe('ok');
      expect(Number.isFinite(out.diag.rmseAnalysis)).toBe(true);
    }
  });

  it('reset() allows re-running from cycle 1', () => {
    const run = new DaRun();
    run.configure({ ...defaultConfig(), N: 10, maxCycles: 3 });
    run.computeCycle(1, 'diagnosticsOnly');
    run.computeCycle(2, 'diagnosticsOnly');
    run.reset();
    expect(() => run.computeCycle(1, 'diagnosticsOnly')).not.toThrow();
  });
});
