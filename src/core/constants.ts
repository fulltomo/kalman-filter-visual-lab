/** Numerical-stability constants (see design spec §7.7). */
export const CHOLESKY_JITTER_EPS0 = 1e-10;
export const CHOLESKY_MAX_ATTEMPTS = 5;
/**
 * Absolute floor for the jitter scale. When a matrix has a non-positive mean
 * diagonal (e.g. an all-zero covariance), relative jitter (ε·meanDiag) would be
 * zero — and ε·Number.MIN_VALUE underflows to 0 in float64 — so the diagonal
 * would never be bumped and Cholesky would keep failing. Flooring the scale at 1
 * guarantees ε·scale ≥ ε for any input, so jitter is always effective.
 */
export const CHOLESKY_JITTER_ABS_FLOOR = 1;

/** Divergence-detection thresholds (design-spec §7.7). */
export const STATE_ABS_LIMIT = 1e3; // |x_i| beyond this ⇒ normExceeded
export const VAR_TRACE_LIMIT = 1e8; // trace(P)/N beyond this ⇒ varExceeded
export const SPREAD_FLOOR = 1e-8; // ensemble-collapse warning floor (used Phase 2+)

/** Twin-experiment setup constants. */
export const SPINUP_STEPS = 1000; // RK4 steps to land truth on the attractor
export const INITIAL_BG_STD = 1.0; // std of the initial background error (x̂₀ᵃ, P₀ᵃ=std²·I)
