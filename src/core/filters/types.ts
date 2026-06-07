import type { SubStepFrame, CycleDiag, DivergenceReason } from '../types';

export type Emit = 'frames' | 'diagnosticsOnly';

export interface CycleOutput {
  frames: SubStepFrame[]; // empty when emit === 'diagnosticsOnly'
  diag: CycleDiag; // NaN fields if the cycle diverged
  status: 'ok' | 'diverged';
  divergence?: { stepId: string; reason: DivergenceReason; detail: string };
}

/** A data-assimilation method advancing one sequential cycle at a time. */
export interface Filter {
  step(cycle: number, emit: Emit): CycleOutput;
  reset(): void;
}
