import { describe, it, expect } from 'vitest';
import { defaultConfig } from './types';
import { validateConfig } from './validate';

describe('validateConfig', () => {
  it('accepts the defaults with no errors', () => {
    const { config, errors, warnings } = validateConfig(defaultConfig());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(config.N).toBe(40);
  });

  it('hard-refuses mathematically undefined values', () => {
    const bad = { ...defaultConfig(), N: 2, dt: 0, k: 1, rho: 0, sigmaObs: 0 };
    const { errors } = validateConfig(bad);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('clamps soft ranges to [min,max]', () => {
    const { config } = validateConfig({ ...defaultConfig(), N: 500, sigmaObs: 1e6, rho: 50 });
    expect(config.N).toBe(128);
    expect(config.sigmaObs).toBe(1e3);
    expect(config.rho).toBe(10);
  });

  it('snaps assimInterval to an integer multiple of dt', () => {
    const { config } = validateConfig({ ...defaultConfig(), dt: 0.05, assimInterval: 0.12 });
    // nearest multiple of 0.05 to 0.12 is 0.10 (2 steps)
    expect(config.assimInterval).toBeCloseTo(0.1, 12);
  });

  it('warns (does not refuse) for a risky dt', () => {
    const { errors, warnings } = validateConfig({ ...defaultConfig(), dt: 0.2 });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.code === 'riskyDt')).toBe(true);
  });

  it('refuses custom coverage with no valid indices', () => {
    const { errors } = validateConfig({ ...defaultConfig(), coverage: 'custom', obsIndices: [] });
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps only in-range custom indices, sorted and deduped', () => {
    const { config } = validateConfig({
      ...defaultConfig(),
      N: 10,
      coverage: 'custom',
      obsIndices: [5, 5, 200, -1, 2],
    });
    expect(config.obsIndices).toEqual([2, 5]);
  });
});
