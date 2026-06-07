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
  const c = rows[0].length;
  const m = mat(r, c);
  for (let i = 0; i < r; i++) {
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
