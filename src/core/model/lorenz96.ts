import { type Mat, mat, identity, mul, add, scale } from '../linalg';

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
  let cur: Float64Array = x.slice();
  for (let s = 0; s < steps; s++) cur = rk4Step(cur, F, dt);
  return cur;
}

/**
 * Jacobian ∂f/∂x of the Lorenz96 rhs at state x (N×N). Independent of F. Requires N >= 4.
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

/**
 * One RK4 step together with the exact Jacobian M = ∂(rk4Step)/∂x (the discrete
 * tangent-linear operator). Propagating M_total = M_S · … · M_1 along the
 * trajectory gives the EKF resolvent over one assimilation interval.
 */
export function rk4StepTLM(x: Float64Array, F: number, dt: number): { x: Float64Array; M: Mat } {
  const n = x.length;
  if (n < 4) throw new Error(`rk4StepTLM: Lorenz96 requires N >= 4, got ${n}`);
  const I = identity(n);

  const k1 = rhs(x, F);
  const K1 = jacobian(x); // ∂k1/∂x
  const x1 = new Float64Array(n);
  for (let i = 0; i < n; i++) x1[i] = x[i] + 0.5 * dt * k1[i];

  const k2 = rhs(x1, F);
  const K2 = mul(jacobian(x1), add(I, scale(K1, 0.5 * dt))); // ∂k2/∂x
  const x2 = new Float64Array(n);
  for (let i = 0; i < n; i++) x2[i] = x[i] + 0.5 * dt * k2[i];

  const k3 = rhs(x2, F);
  const K3 = mul(jacobian(x2), add(I, scale(K2, 0.5 * dt))); // ∂k3/∂x
  const x3 = new Float64Array(n);
  for (let i = 0; i < n; i++) x3[i] = x[i] + dt * k3[i];

  const k4 = rhs(x3, F);
  const K4 = mul(jacobian(x3), add(I, scale(K3, dt))); // ∂k4/∂x

  const xn = new Float64Array(n);
  for (let i = 0; i < n; i++) xn[i] = x[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);

  // M = I + (dt/6)(K1 + 2K2 + 2K3 + K4)
  const sum = add(add(K1, scale(K2, 2)), add(scale(K3, 2), K4));
  const M = add(I, scale(sum, dt / 6));
  return { x: xn, M };
}
