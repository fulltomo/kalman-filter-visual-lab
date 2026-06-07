import type { Config } from './types';
import { type Mat, mat } from './linalg';
import { makeRng } from './rng';
import { integrate } from './model/lorenz96';
import { SPINUP_STEPS, INITIAL_BG_STD } from './constants';

export interface Experiment {
  config: Config;
  N: number;
  m: number; // number of observations
  obsIndices: number[];
  stepsPerCycle: number; // assimInterval / dt
  H: Mat; // m×N selection matrix
  R: Mat; // m×m diagonal, σ²
  truth(cycle: number): Float64Array; // truth state at cycle (0-based)
  observation(cycle: number): Float64Array; // noisy obs (length m)
  background0(): { mean: Float64Array; cov: Mat }; // filter's initial analysis
  applyH(x: Float64Array): Float64Array; // observed components of x
}

function obsIndicesFor(config: Config): number[] {
  const { N, coverage } = config;
  if (coverage === 'all') return Array.from({ length: N }, (_, i) => i);
  if (coverage === 'sparse') {
    const out: number[] = [];
    for (let i = 0; i < N; i += 2) out.push(i);
    return out;
  }
  return [...config.obsIndices]; // already cleaned by validateConfig
}

export function buildExperiment(config: Config): Experiment {
  const { N, F, dt, seed, sigmaObs, maxCycles } = config;
  const stepsPerCycle = Math.max(1, Math.round(config.assimInterval / dt));
  const obsIndices = obsIndicesFor(config);
  const m = obsIndices.length;

  const H = mat(m, N);
  for (let r = 0; r < m; r++) H.data[r * N + obsIndices[r]] = 1;
  const R = mat(m, m);
  for (let i = 0; i < m; i++) R.data[i * m + i] = sigmaObs * sigmaObs;

  const rng = makeRng(seed);

  // Spin up onto the attractor from a perturbed fixed point.
  let x: Float64Array = new Float64Array(N).fill(F);
  x[0] += 0.01;
  x = integrate(x, F, dt, SPINUP_STEPS);

  // Precompute the truth trajectory at every cycle's analysis time.
  const truthStates: Float64Array[] = [x.slice()];
  for (let c = 1; c <= maxCycles; c++) {
    x = integrate(x, F, dt, stepsPerCycle);
    truthStates.push(x.slice());
  }

  // Precompute noisy observations in a fixed cycle order (deterministic).
  const obs: Float64Array[] = [];
  for (let c = 0; c <= maxCycles; c++) {
    const t = truthStates[c];
    const y = new Float64Array(m);
    for (let r = 0; r < m; r++) y[r] = t[obsIndices[r]] + sigmaObs * rng.gaussian();
    obs.push(y);
  }

  // Initial background: truth₀ + N(0, INITIAL_BG_STD²), P₀ᵃ = INITIAL_BG_STD²·I.
  const bgMean = truthStates[0].slice();
  for (let i = 0; i < N; i++) bgMean[i] += INITIAL_BG_STD * rng.gaussian();
  const bgCov = mat(N, N);
  for (let i = 0; i < N; i++) bgCov.data[i * N + i] = INITIAL_BG_STD * INITIAL_BG_STD;

  return {
    config,
    N,
    m,
    obsIndices,
    stepsPerCycle,
    H,
    R,
    truth: (c) => truthStates[c],
    observation: (c) => obs[c],
    background0: () => ({
      mean: bgMean.slice(),
      cov: { rows: N, cols: N, data: bgCov.data.slice() },
    }),
    applyH: (xv) => {
      const o = new Float64Array(m);
      for (let r = 0; r < m; r++) o[r] = xv[obsIndices[r]];
      return o;
    },
  };
}
