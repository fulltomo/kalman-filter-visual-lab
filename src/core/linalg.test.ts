import { describe, it, expect } from 'vitest';
import { mat, fromRows, identity, get, mul, transpose, add, sub, scale, symmetrize, matVec } from './linalg';

describe('linalg basic ops', () => {
  it('creates a zero matrix', () => {
    const m = mat(2, 3);
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(3);
    expect(Array.from(m.data)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('builds identity', () => {
    expect(Array.from(identity(2).data)).toEqual([1, 0, 0, 1]);
  });

  it('multiplies matrices', () => {
    const a = fromRows([[1, 2], [3, 4]]);
    const b = fromRows([[5, 6], [7, 8]]);
    const c = mul(a, b);
    expect(Array.from(c.data)).toEqual([19, 22, 43, 50]);
  });

  it('transposes', () => {
    const a = fromRows([[1, 2, 3], [4, 5, 6]]);
    const t = transpose(a);
    expect(t.rows).toBe(3);
    expect(t.cols).toBe(2);
    expect(get(t, 2, 1)).toBe(6);
    expect(Array.from(t.data)).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('adds, subtracts, scales', () => {
    const a = fromRows([[1, 2], [3, 4]]);
    const b = fromRows([[1, 1], [1, 1]]);
    expect(Array.from(add(a, b).data)).toEqual([2, 3, 4, 5]);
    expect(Array.from(sub(a, b).data)).toEqual([0, 1, 2, 3]);
    expect(Array.from(scale(a, 2).data)).toEqual([2, 4, 6, 8]);
  });

  it('symmetrizes', () => {
    const a = fromRows([[1, 3], [1, 1]]);
    expect(Array.from(symmetrize(a).data)).toEqual([1, 2, 2, 1]);
  });

  it('multiplies matrix by vector', () => {
    const a = fromRows([[1, 2], [3, 4]]);
    const v = Float64Array.from([1, 1]);
    expect(Array.from(matVec(a, v))).toEqual([3, 7]);
  });

  it('throws on shape mismatch', () => {
    expect(() => mul(mat(2, 3), mat(2, 2))).toThrow();
    expect(() => add(mat(2, 2), mat(2, 3))).toThrow(/add/);
    expect(() => matVec(mat(2, 3), Float64Array.from([1, 2]))).toThrow();
  });

  it('throws on empty or ragged fromRows input', () => {
    expect(() => fromRows([])).toThrow(/empty/);
    expect(() => fromRows([[1, 2], [3]])).toThrow(/ragged/);
  });
});
