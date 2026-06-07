import type { Mat } from './linalg';
import type { DivergenceReason } from './types';
import { STATE_ABS_LIMIT, VAR_TRACE_LIMIT } from './constants';

/** NaN/Inf or norm explosion in a state vector. NaN/Inf takes priority. */
export function checkVector(x: Float64Array): DivergenceReason | null {
  let normExceeded = false;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Number.isNaN(v)) return 'nan';
    if (!Number.isFinite(v)) return 'inf';
    if (Math.abs(v) > STATE_ABS_LIMIT) normExceeded = true;
  }
  return normExceeded ? 'normExceeded' : null;
}

/** NaN/Inf in any entry, or trace(P)/N explosion. */
export function checkCovariance(p: Mat): DivergenceReason | null {
  for (let idx = 0; idx < p.data.length; idx++) {
    const v = p.data[idx];
    if (Number.isNaN(v)) return 'nan';
    if (!Number.isFinite(v)) return 'inf';
  }
  const n = p.rows;
  let trace = 0;
  for (let i = 0; i < n; i++) trace += p.data[i * p.cols + i];
  return trace / n > VAR_TRACE_LIMIT ? 'varExceeded' : null;
}
