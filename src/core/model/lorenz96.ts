/** Lorenz (1996): dx_i/dt = (x_{i+1} - x_{i-2}) x_{i-1} - x_i + F, cyclic. Requires N >= 4. */
export function rhs(x: Float64Array, F: number, out?: Float64Array): Float64Array {
  const n = x.length;
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
