import type { Config } from './types';
import { FLOP_THROUGHPUT, FRAME_MAT_COUNT } from './constants';

export type PerfTier = 'green' | 'yellow' | 'red';

export interface PerfEstimate {
  flopPerCycle: number;
  msPerCycle: number;
  bytesPerCycle: number; // materialized frames for one viewed cycle
  bytesTotal: number; // upper bound if every cycle were cached
  tier: PerfTier;
  message: string;
}

function classify(msPerCycle: number, bytesTotal: number): PerfTier {
  const mb = bytesTotal / 1e6;
  if (msPerCycle > 500 || mb > 200) return 'red';
  if (msPerCycle >= 50 || mb >= 50) return 'yellow';
  return 'green';
}

export function estimateCost(config: Config): PerfEstimate {
  const N = config.N;
  const S = Math.max(1, Math.round(config.assimInterval / config.dt));
  // EKF dominant cost: S TLM compositions (~2N³ each) + cov propagation + Joseph (~6N³).
  const flopPerCycle = (2 * S + 6) * N ** 3;
  const msPerCycle = (flopPerCycle / FLOP_THROUGHPUT) * 1000;
  const bytesPerCycle = 8 * N * N * FRAME_MAT_COUNT;
  const bytesTotal = bytesPerCycle * config.maxCycles;
  const tier = classify(msPerCycle, bytesTotal);
  const message = `推定 ${msPerCycle.toFixed(1)} ms/サイクル・メモリ約 ${(bytesTotal / 1e6).toFixed(
    1,
  )} MB（${tier}）。`;
  return { flopPerCycle, msPerCycle, bytesPerCycle, bytesTotal, tier, message };
}
