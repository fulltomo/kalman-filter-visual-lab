export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal N(0, 1). */
  gaussian(): number;
}

/** mulberry32 PRNG + Box–Muller gaussian. Reproducible from an integer seed. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare: number | null = null;
  const gaussian = (): number => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };

  return { next, gaussian };
}
