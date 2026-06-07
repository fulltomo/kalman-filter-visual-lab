import { CHOLESKY_JITTER_EPS0, CHOLESKY_MAX_ATTEMPTS, CHOLESKY_JITTER_ABS_FLOOR } from './constants';

/** Row-major dense matrix. */
export interface Mat {
  rows: number;
  cols: number;
  data: Float64Array;
}

export function mat(rows: number, cols: number, fill = 0): Mat {
  const data = new Float64Array(rows * cols);
  if (fill !== 0) data.fill(fill);
  return { rows, cols, data };
}

export function fromRows(rows: number[][]): Mat {
  const r = rows.length;
  if (r === 0) throw new Error('fromRows: empty input');
  const c = rows[0].length;
  const m = mat(r, c);
  for (let i = 0; i < r; i++) {
    if (rows[i].length !== c) {
      throw new Error(`fromRows: ragged row ${i} (expected ${c}, got ${rows[i].length})`);
    }
    for (let j = 0; j < c; j++) m.data[i * c + j] = rows[i][j];
  }
  return m;
}

export function identity(n: number): Mat {
  const m = mat(n, n);
  for (let i = 0; i < n; i++) m.data[i * n + i] = 1;
  return m;
}

export function get(m: Mat, i: number, j: number): number {
  return m.data[i * m.cols + j];
}

export function set(m: Mat, i: number, j: number, v: number): void {
  m.data[i * m.cols + j] = v;
}

export function clone(m: Mat): Mat {
  return { rows: m.rows, cols: m.cols, data: m.data.slice() };
}

export function mul(a: Mat, b: Mat): Mat {
  if (a.cols !== b.rows) {
    throw new Error(`mul: shape ${a.rows}x${a.cols} * ${b.rows}x${b.cols}`);
  }
  const m = mat(a.rows, b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      const aik = a.data[i * a.cols + k];
      // Skip zero multiplicands (dense-accumulation speedup). This intentionally
      // suppresses 0*Inf / 0*NaN, which is safe here: A is never a structural-zero
      // matrix coinciding with Inf/NaN in B — divergence detection fires on the
      // state vector before such a product could arise.
      if (aik === 0) continue;
      for (let j = 0; j < b.cols; j++) {
        m.data[i * b.cols + j] += aik * b.data[k * b.cols + j];
      }
    }
  }
  return m;
}

export function transpose(a: Mat): Mat {
  const m = mat(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) m.data[j * a.rows + i] = a.data[i * a.cols + j];
  }
  return m;
}

function elementwise(a: Mat, b: Mat, op: (x: number, y: number) => number, name: string): Mat {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error(`${name}: shape ${a.rows}x${a.cols} vs ${b.rows}x${b.cols}`);
  }
  const m = mat(a.rows, a.cols);
  for (let i = 0; i < a.data.length; i++) m.data[i] = op(a.data[i], b.data[i]);
  return m;
}

export function add(a: Mat, b: Mat): Mat {
  return elementwise(a, b, (x, y) => x + y, 'add');
}

export function sub(a: Mat, b: Mat): Mat {
  return elementwise(a, b, (x, y) => x - y, 'sub');
}

export function scale(a: Mat, s: number): Mat {
  const m = mat(a.rows, a.cols);
  for (let i = 0; i < a.data.length; i++) m.data[i] = a.data[i] * s;
  return m;
}

export function symmetrize(a: Mat): Mat {
  if (a.rows !== a.cols) throw new Error('symmetrize: not square');
  const n = a.rows;
  const m = mat(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      m.data[i * n + j] = 0.5 * (a.data[i * n + j] + a.data[j * n + i]);
    }
  }
  return m;
}

export function matVec(a: Mat, v: Float64Array): Float64Array {
  if (a.cols !== v.length) throw new Error(`matVec: shape ${a.rows}x${a.cols} * ${v.length}`);
  const out = new Float64Array(a.rows);
  for (let i = 0; i < a.rows; i++) {
    let s = 0;
    for (let j = 0; j < a.cols; j++) s += a.data[i * a.cols + j] * v[j];
    out[i] = s;
  }
  return out;
}

/** Lower-triangular Cholesky factor L (A = L Lᵀ), or null if A is not positive definite. */
export function choleskyFactor(a: Mat): Mat | null {
  const n = a.rows;
  if (a.cols !== n) throw new Error('cholesky: not square');
  const L = mat(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = a.data[i * n + j];
      for (let k = 0; k < j; k++) sum -= L.data[i * n + k] * L.data[j * n + k];
      if (i === j) {
        if (sum <= 0) return null;
        L.data[i * n + j] = Math.sqrt(sum);
      } else {
        L.data[i * n + j] = sum / L.data[j * n + j];
      }
    }
  }
  return L;
}

function meanDiag(a: Mat): number {
  let s = 0;
  for (let i = 0; i < a.rows; i++) s += a.data[i * a.cols + i];
  return s / a.rows;
}

/**
 * Solve A X = B for symmetric positive-definite A via Cholesky.
 * On failure, add relative jitter (ε·mean(diag)·I), escalating ε ×10 up to
 * CHOLESKY_MAX_ATTEMPTS times. Throws only if still not factorable.
 */
export function choleskySolve(a: Mat, b: Mat): { x: Mat; jitterApplied: boolean } {
  const n = a.rows;
  let L = choleskyFactor(a);
  let jitterApplied = false;
  if (L === null) {
    jitterApplied = true;
    const tau = Math.max(meanDiag(a), CHOLESKY_JITTER_ABS_FLOOR);
    let eps = CHOLESKY_JITTER_EPS0;
    for (let attempt = 0; attempt < CHOLESKY_MAX_ATTEMPTS && L === null; attempt++) {
      const aj = clone(a);
      const bump = eps * tau;
      for (let i = 0; i < n; i++) aj.data[i * n + i] += bump;
      L = choleskyFactor(aj);
      eps *= 10;
    }
    if (L === null) throw new Error('choleskySolve: not positive definite after jitter');
  }

  const x = mat(n, b.cols);
  const y = new Float64Array(n);
  for (let c = 0; c < b.cols; c++) {
    // forward substitution: L y = b[:, c]
    for (let i = 0; i < n; i++) {
      let s = b.data[i * b.cols + c];
      for (let k = 0; k < i; k++) s -= L.data[i * n + k] * y[k];
      y[i] = s / L.data[i * n + i];
    }
    // back substitution: Lᵀ x = y
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let k = i + 1; k < n; k++) s -= L.data[k * n + i] * x.data[k * b.cols + c];
      x.data[i * b.cols + c] = s / L.data[i * n + i];
    }
  }
  return { x, jitterApplied };
}
