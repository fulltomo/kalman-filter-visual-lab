import { describe, it, expect } from 'vitest';
import { identity, scale } from './linalg';
import { checkVector, checkCovariance } from './divergence';

describe('checkVector', () => {
  it('returns null for a healthy state', () => {
    expect(checkVector(Float64Array.from([1, -2, 3]))).toBeNull();
  });

  it('detects NaN', () => {
    expect(checkVector(Float64Array.from([1, NaN, 3]))).toBe('nan');
  });

  it('detects Inf', () => {
    expect(checkVector(Float64Array.from([1, Infinity, 3]))).toBe('inf');
  });

  it('detects a norm explosion', () => {
    expect(checkVector(Float64Array.from([0, 5000, 0]))).toBe('normExceeded');
  });
});

describe('checkCovariance', () => {
  it('returns null for a healthy covariance', () => {
    expect(checkCovariance(identity(4))).toBeNull();
  });

  it('detects NaN in any entry', () => {
    const p = identity(3);
    p.data[1] = NaN;
    expect(checkCovariance(p)).toBe('nan');
  });

  it('detects a trace explosion', () => {
    // trace/N = 1e9 > VAR_TRACE_LIMIT (1e8)
    expect(checkCovariance(scale(identity(4), 1e9))).toBe('varExceeded');
  });
});
