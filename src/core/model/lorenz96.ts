import { type Mat, mat } from '../linalg';

/** Lorenz (1996): dx_i/dt = (x_{i+1} - x_{i-2}) x_{i-1} - x_i + F, cyclic. Requires N >= 4. */
export function rhs(x: Float64Array, F: number, out?: Float64Array): Float64Array {
  const n = x.length;
  // The cyclic stencil reads x[i-1]/x[i-2], so writing into x in place would
  // corrupt later iterations; require a distinct output buffer.
  if (out === x) throw new Error('rhs: out must not alias x');
  const d = out ?? new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ip1 = x[(i + 1) % n];
    const im1 = x[(i - 1 + n) % n];
    const im2 = x[(i - 2 + n) % n];
    d[i] = (ip1 - im2) * im1 - x[i] + F;
  }
  return d;
}

export function rk4Step(x: Float64Array, F: number, dt: number): Float64Array {
  const n = x.length;
  if (n < 4) throw new Error(`rk4Step: Lorenz96 requires N >= 4, got ${n}`);
  const k1 = rhs(x, F);
  const tmp = new Float64Array(n);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k1[i];
  const k2 = rhs(tmp, F);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k2[i];
  const k3 = rhs(tmp, F);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + dt * k3[i];
  const k4 = rhs(tmp, F);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = x[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

export function integrate(x: Float64Array, F: number, dt: number, steps: number): Float64Array {
  let cur = x.slice();
  for (let s = 0; s < steps; s++) cur = rk4Step(cur, F, dt);
  return cur;
}

/**
 * Jacobian ∂f/∂x of the Lorenz96 rhs at state x (N×N). Independent of F.
 * Nonzero partials of f_i = (x_{i+1} - x_{i-2}) x_{i-1} - x_i + F:
 *   ∂f_i/∂x_{i-2} = -x_{i-1},  ∂f_i/∂x_{i-1} = x_{i+1} - x_{i-2},
 *   ∂f_i/∂x_i = -1,           ∂f_i/∂x_{i+1} = x_{i-1}.
 */
export function jacobian(x: Float64Array): Mat {
  const n = x.length;
  const J = mat(n, n);
  for (let i = 0; i < n; i++) {
    const ip1 = (i + 1) % n;
    const im1 = (i - 1 + n) % n;
    const im2 = (i - 2 + n) % n;
    J.data[i * n + im2] += -x[im1];
    J.data[i * n + im1] += x[ip1] - x[im2];
    J.data[i * n + i] += -1;
    J.data[i * n + ip1] += x[im1];
  }
  return J;
}
