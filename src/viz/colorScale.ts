export type RGB = [number, number, number];

/** Color for NaN/Inf cells (a neutral magenta, distinct from the colormap). */
export const NONFINITE_RGB: RGB = [136, 0, 136];

/** Robust scale: the q-quantile (0..1) of |finite values|. Returns >0. */
export function percentileAbs(data: Float64Array, q: number): number {
  const abs: number[] = [];
  for (const v of data) if (Number.isFinite(v)) abs.push(Math.abs(v));
  if (abs.length === 0) return 1;
  abs.sort((a, b) => a - b);
  const idx = Math.min(abs.length - 1, Math.max(0, Math.round(q * (abs.length - 1))));
  return abs[idx] || 1;
}

/** Sign-preserving log normalization of `v` to [-1, 1] given a positive `scale`. */
export function symLogNorm(v: number, scale: number): number {
  if (!Number.isFinite(v) || scale <= 0) return 0;
  const s = Math.sign(v);
  const mag = Math.log1p(Math.abs(v)) / Math.log1p(scale);
  return s * Math.min(1, mag);
}

/** Blue→white→red diverging colormap over t ∈ [-1, 1]. Non-finite ⇒ sentinel. */
export function divergingColor(t: number): RGB {
  if (!Number.isFinite(t)) return NONFINITE_RGB;
  const x = Math.min(1, Math.max(-1, t));
  if (x >= 0) {
    // white (255,255,255) → red (200,30,30)
    return [255 - 55 * x, 255 - 225 * x, 255 - 225 * x];
  }
  // white → blue (30,60,200)
  const a = -x;
  return [255 - 225 * a, 255 - 195 * a, 255 - 55 * a];
}
