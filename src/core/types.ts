import type { Mat } from './linalg';

export type Phase = 'forecast' | 'analysis';
export type Method = 'ekf' | 'po' | 'ensrf' | 'etkf' | 'letkf';
export type Coverage = 'all' | 'sparse' | 'custom';

/** Full experiment configuration (design-spec §9). */
export interface Config {
  method: Method;
  N: number; // state dimension
  F: number; // Lorenz96 forcing
  dt: number; // integration step
  assimInterval: number; // time between analyses (integer multiple of dt)
  coverage: Coverage; // observation network
  obsIndices: number[]; // used when coverage === 'custom'
  sigmaObs: number; // observation error std
  k: number; // ensemble size (unused by EKF; part of the shared contract)
  rho: number; // multiplicative inflation
  locRadius: number; // Gaspari–Cohn localization radius
  Q: number; // model-error variance (EKF), Q = Q·I
  seed: number; // PRNG seed (reproducibility)
  maxCycles: number; // number of assimilation cycles
}

/** §9 defaults; "Classic" Lorenz96 twin experiment. */
export function defaultConfig(): Config {
  return {
    method: 'ekf',
    N: 40,
    F: 8,
    dt: 0.05,
    assimInterval: 0.05,
    coverage: 'sparse',
    obsIndices: [],
    sigmaObs: 1,
    k: 20,
    rho: 1.05,
    locRadius: 4,
    Q: 0,
    seed: 42,
    maxCycles: 200,
  };
}

export type WarnCode =
  | 'riskyDt'
  | 'jitterApplied'
  | 'eigFloored'
  | 'ensembleCollapse'
  | 'heavyConfig';
export type ErrorCode = 'protocolMismatch' | 'invalidConfig' | 'choleskyFailed' | 'internal';
export interface Warning {
  code: WarnCode;
  message: string;
}

/** A typed error carrying an ErrorCode (used by the run orchestrator). */
export class ConfigError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type QuantityKind = 'matrix' | 'vector' | 'scalar';

/** A named numeric value (matrix/vector/scalar) attached to a frame. Row-major. */
export interface NamedQuantity {
  role: string; // machine id, e.g. "P_f", "K", "innovation"
  label: string; // display name (Japanese)
  kind: QuantityKind;
  data: Float64Array;
  rows: number;
  cols: number;
}

export type DivergenceReason = 'nan' | 'inf' | 'normExceeded' | 'varExceeded';

/** One visualized algebraic step (design-spec §5). */
export interface SubStepFrame {
  cycle: number;
  phase: Phase;
  stepId: string; // e.g. "ekf.analysis.gain"
  index: number; // order within the cycle
  title: string;
  equationLatex: string; // KaTeX source
  highlightTerms: string[]; // terms to cross-highlight against panels
  description: string;
  snapshot: NamedQuantity[];
  status?: 'ok' | 'diverged';
  message?: string;
}

/** Per-cycle diagnostic increment. */
export interface CycleDiag {
  rmseAnalysis: number;
  rmseForecast: number;
  spread: number;
}

/** Cross-cycle diagnostic time series. */
export interface Diagnostics {
  cycles: number[];
  rmseAnalysis: number[];
  rmseForecast: number[];
  spread: number[];
}

export function quantityFromMat(role: string, label: string, m: Mat): NamedQuantity {
  return { role, label, kind: 'matrix', data: m.data.slice(), rows: m.rows, cols: m.cols };
}

export function quantityFromVec(role: string, label: string, v: Float64Array): NamedQuantity {
  return { role, label, kind: 'vector', data: v.slice(), rows: v.length, cols: 1 };
}

export function quantityScalar(role: string, label: string, v: number): NamedQuantity {
  return { role, label, kind: 'scalar', data: Float64Array.of(v), rows: 1, cols: 1 };
}
