import type { Config, Warning } from './types';

export interface ValidationResult {
  config: Config; // cleaned/clamped (best-effort even when errors present)
  warnings: Warning[];
  errors: string[]; // hard violations; empty ⇒ acceptable
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clampInt(v: number, lo: number, hi: number): number {
  return clamp(Math.round(v), lo, hi);
}

export function validateConfig(raw: Config): ValidationResult {
  const errors: string[] = [];
  const warnings: Warning[] = [];
  const c: Config = { ...raw, obsIndices: [...raw.obsIndices] };

  // Hard refuse: mathematically undefined (design-spec §7.1).
  if (!(c.N >= 4)) errors.push('N must be >= 4');
  if (!(c.dt > 0)) errors.push('dt must be > 0');
  if (!(c.k >= 2)) errors.push('k must be >= 2');
  if (!(c.rho > 0)) errors.push('rho must be > 0');
  if (!(c.sigmaObs > 0)) errors.push('sigmaObs must be > 0');
  if (!(c.assimInterval > 0)) errors.push('assimInterval must be > 0');

  // Clamp soft ranges (design-spec §9).
  c.N = clampInt(c.N, 4, 128);
  c.F = clamp(c.F, 0, 20);
  c.dt = clamp(c.dt, 1e-6, 0.5);
  c.sigmaObs = clamp(c.sigmaObs, 1e-3, 1e3);
  c.k = clampInt(c.k, 2, 200);
  c.rho = clamp(c.rho, 1e-6, 10);
  c.locRadius = clamp(c.locRadius, 0, c.N);
  c.Q = Math.max(c.Q, 0);
  c.maxCycles = clampInt(c.maxCycles, 1, 1000);

  // assimInterval must be a positive integer multiple of dt: snap to nearest.
  const steps = Math.max(1, Math.round(c.assimInterval / c.dt));
  c.assimInterval = steps * c.dt;

  // Custom coverage: keep in-range integer indices, dedupe, sort.
  if (c.coverage === 'custom') {
    const set = new Set<number>();
    for (const i of c.obsIndices) {
      if (Number.isInteger(i) && i >= 0 && i < c.N) set.add(i);
    }
    c.obsIndices = [...set].sort((a, b) => a - b);
    if (c.obsIndices.length === 0) errors.push('custom coverage needs at least one valid index');
  }

  // Soft warnings.
  if (c.dt > 0.1) {
    warnings.push({
      code: 'riskyDt',
      message: `dt=${c.dt} は Lorenz96 が発散しやすい領域です（dt≤0.1 推奨）。`,
    });
  }

  return { config: c, warnings, errors };
}
