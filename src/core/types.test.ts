import { describe, it, expect } from 'vitest';
import { mat } from './linalg';
import {
  defaultConfig,
  quantityFromMat,
  quantityFromVec,
  quantityScalar,
  type Config,
} from './types';

describe('defaultConfig', () => {
  it('returns the design-spec §9 defaults', () => {
    const c = defaultConfig();
    expect(c.method).toBe('ekf');
    expect(c.N).toBe(40);
    expect(c.F).toBe(8);
    expect(c.dt).toBe(0.05);
    expect(c.assimInterval).toBe(0.05);
    expect(c.coverage).toBe('sparse');
    expect(c.sigmaObs).toBe(1);
    expect(c.k).toBe(20);
    expect(c.rho).toBeCloseTo(1.05, 12);
    expect(c.locRadius).toBe(4);
    expect(c.Q).toBe(0);
    expect(c.maxCycles).toBe(200);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = defaultConfig();
    const b = defaultConfig();
    a.obsIndices.push(99);
    expect(b.obsIndices).toEqual([]);
    expect(a).not.toBe(b);
  });
});

describe('quantity helpers', () => {
  it('wraps a matrix and copies its data (no aliasing)', () => {
    const m = mat(2, 2);
    m.data[0] = 5;
    const q = quantityFromMat('P_f', '予報共分散', m);
    expect(q.kind).toBe('matrix');
    expect(q.rows).toBe(2);
    expect(q.cols).toBe(2);
    expect(Array.from(q.data)).toEqual([5, 0, 0, 0]);
    m.data[0] = 9; // mutate source after wrapping
    expect(q.data[0]).toBe(5); // snapshot is detached
  });

  it('wraps a vector as an Nx1 column', () => {
    const q = quantityFromVec('d', 'イノベーション', Float64Array.from([1, 2, 3]));
    expect(q.kind).toBe('vector');
    expect(q.rows).toBe(3);
    expect(q.cols).toBe(1);
    expect(Array.from(q.data)).toEqual([1, 2, 3]);
  });

  it('wraps a scalar as a 1x1', () => {
    const q = quantityScalar('rmse', 'RMSE', 0.5);
    expect(q.kind).toBe('scalar');
    expect(q.rows).toBe(1);
    expect(q.cols).toBe(1);
    expect(Array.from(q.data)).toEqual([0.5]);
  });
});

// Compile-time contract: a SubStepFrame literal must satisfy the type.
const _frame: import('./types').SubStepFrame = {
  cycle: 1,
  phase: 'analysis',
  stepId: 'ekf.analysis.gain',
  index: 0,
  title: 'カルマンゲイン',
  equationLatex: 'K = P^f H^\\top S^{-1}',
  highlightTerms: ['K'],
  description: 'ゲイン',
  snapshot: [],
};
const _cfg: Config = defaultConfig();
void _frame;
void _cfg;
