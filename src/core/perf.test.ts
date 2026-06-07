import { describe, it, expect } from 'vitest';
import { defaultConfig } from './types';
import { estimateCost } from './perf';

describe('estimateCost', () => {
  it('rates the default (config A) green', () => {
    const e = estimateCost({ ...defaultConfig(), N: 40, maxCycles: 200 });
    expect(e.tier).toBe('green');
    expect(e.msPerCycle).toBeGreaterThan(0);
  });

  it('rates a heavy EKF config (B: N=128, S=5) at least yellow', () => {
    const e = estimateCost({
      ...defaultConfig(),
      N: 128,
      dt: 0.01,
      assimInterval: 0.05, // S = 5
      maxCycles: 200,
    });
    expect(['yellow', 'red']).toContain(e.tier);
  });

  it('rates a memory-heavy config red', () => {
    const e = estimateCost({ ...defaultConfig(), N: 128, maxCycles: 1000 });
    expect(e.tier).toBe('red');
  });

  it('reports the integration steps per cycle in the flop estimate', () => {
    const small = estimateCost({ ...defaultConfig(), N: 40, dt: 0.05, assimInterval: 0.05 });
    const long = estimateCost({ ...defaultConfig(), N: 40, dt: 0.01, assimInterval: 0.05 });
    expect(long.flopPerCycle).toBeGreaterThan(small.flopPerCycle);
  });
});
