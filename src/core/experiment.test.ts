import { describe, it, expect } from 'vitest';
import { defaultConfig } from './types';
import { buildExperiment } from './experiment';

describe('buildExperiment', () => {
  it('is fully reproducible from the seed', () => {
    const a = buildExperiment({ ...defaultConfig(), N: 10, maxCycles: 5 });
    const b = buildExperiment({ ...defaultConfig(), N: 10, maxCycles: 5 });
    expect(Array.from(a.truth(3))).toEqual(Array.from(b.truth(3)));
    expect(Array.from(a.observation(3))).toEqual(Array.from(b.observation(3)));
    expect(Array.from(a.background0().mean)).toEqual(Array.from(b.background0().mean));
  });

  it('changing the seed changes the trajectory/observations', () => {
    const a = buildExperiment({ ...defaultConfig(), N: 10, maxCycles: 5, seed: 1 });
    const b = buildExperiment({ ...defaultConfig(), N: 10, maxCycles: 5, seed: 2 });
    expect(Array.from(a.observation(2))).not.toEqual(Array.from(b.observation(2)));
  });

  it('sparse coverage observes every other variable', () => {
    const e = buildExperiment({ ...defaultConfig(), N: 8, coverage: 'sparse', maxCycles: 1 });
    expect(e.obsIndices).toEqual([0, 2, 4, 6]);
    expect(e.m).toBe(4);
    expect(e.H.rows).toBe(4);
    expect(e.H.cols).toBe(8);
  });

  it('all coverage observes every variable', () => {
    const e = buildExperiment({ ...defaultConfig(), N: 6, coverage: 'all', maxCycles: 1 });
    expect(e.obsIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('applyH selects the observed components and matches H·x', () => {
    const e = buildExperiment({ ...defaultConfig(), N: 6, coverage: 'sparse', maxCycles: 1 });
    const x = Float64Array.from([10, 11, 12, 13, 14, 15]);
    expect(Array.from(e.applyH(x))).toEqual([10, 12, 14]);
  });

  it('observation noise has ~sigmaObs std around the truth', () => {
    const N = 20;
    const cycles = 200;
    const sigmaObs = 2;
    const e = buildExperiment({
      ...defaultConfig(),
      N,
      coverage: 'all',
      sigmaObs,
      maxCycles: cycles,
    });
    let sumSq = 0;
    let count = 0;
    for (let c = 1; c <= cycles; c++) {
      const t = e.truth(c);
      const y = e.observation(c);
      for (let r = 0; r < e.m; r++) {
        const err = y[r] - t[e.obsIndices[r]];
        sumSq += err * err;
        count++;
      }
    }
    const std = Math.sqrt(sumSq / count);
    expect(std).toBeGreaterThan(sigmaObs * 0.85);
    expect(std).toBeLessThan(sigmaObs * 1.15);
  });

  it('R is sigmaObs^2 on the diagonal', () => {
    const e = buildExperiment({ ...defaultConfig(), N: 6, coverage: 'all', sigmaObs: 3, maxCycles: 1 });
    expect(e.R.data[0]).toBe(9);
    expect(e.R.data[e.m + 1]).toBe(9); // (1,1) entry
  });
});
