import type { Config, Diagnostics } from '../core/types';
import { DaRun } from '../core/run';
import { PROTOCOL_VERSION, type Command, type WorkerEvent } from './protocol';

const TIME_BUDGET_MS = 16;

type Post = (e: WorkerEvent) => void;
type Schedule = () => Promise<void>;

const defaultSchedule: Schedule = () => new Promise((r) => setTimeout(r, 0));

export interface WorkerCore {
  handle(cmd: Command): Promise<void>;
}

export function createWorkerCore(post: Post, schedule: Schedule = defaultSchedule): WorkerCore {
  const run = new DaRun();
  let latestEpoch = 0;
  let appliedConfig: Config | null = null;
  const diag: Diagnostics = { cycles: [], rmseAnalysis: [], rmseForecast: [], spread: [] };

  const base = (cmd: Command) => ({ protocol: PROTOCOL_VERSION, id: cmd.id, epoch: cmd.epoch });

  const resetDiag = (): void => {
    diag.cycles = [];
    diag.rmseAnalysis = [];
    diag.rmseForecast = [];
    diag.spread = [];
  };

  const snapshotDiag = (): Diagnostics => ({
    cycles: [...diag.cycles],
    rmseAnalysis: [...diag.rmseAnalysis],
    rmseForecast: [...diag.rmseForecast],
    spread: [...diag.spread],
  });

  async function handle(cmd: Command): Promise<void> {
    if (cmd.epoch > latestEpoch) latestEpoch = cmd.epoch;

    switch (cmd.type) {
      case 'init':
        post({ ...base(cmd), type: 'ready', protocol: PROTOCOL_VERSION });
        return;

      case 'configure': {
        try {
          const res = run.configure(cmd.config);
          appliedConfig = res.appliedConfig;
          resetDiag();
          post({
            ...base(cmd),
            type: 'configured',
            dims: res.dims,
            appliedConfig: res.appliedConfig,
            warnings: res.warnings,
          });
        } catch (e) {
          const err = e as { code?: string; message?: string };
          post({
            ...base(cmd),
            type: 'error',
            code: err.code ?? 'internal',
            message: err.message ?? String(e),
            recoverable: true,
          });
        }
        return;
      }

      case 'run': {
        if (!appliedConfig) {
          post({ ...base(cmd), type: 'error', code: 'internal', message: 'configure first', recoverable: true });
          return;
        }
        let last = Date.now();
        for (let c = cmd.fromCycle; c <= cmd.toCycle; c++) {
          if (cmd.epoch < latestEpoch) {
            post({ ...base(cmd), type: 'cancelled', epoch: cmd.epoch, atCycle: c - 1 });
            return;
          }
          const out = run.computeCycle(c, cmd.emit);
          if (out.status === 'diverged' && out.divergence) {
            post({
              ...base(cmd),
              type: 'diverged',
              cycle: c,
              stepId: out.divergence.stepId,
              reason: out.divergence.reason,
              detail: out.divergence.detail,
            });
            return;
          }
          diag.cycles.push(c);
          diag.rmseAnalysis.push(out.diag.rmseAnalysis);
          diag.rmseForecast.push(out.diag.rmseForecast);
          diag.spread.push(out.diag.spread);
          post({ ...base(cmd), type: 'cycleFrames', cycle: c, frames: out.frames ?? [], diag: out.diag });
          post({ ...base(cmd), type: 'progress', cycle: c, total: cmd.toCycle, phase: 'analysis' });
          if (Date.now() - last >= TIME_BUDGET_MS) {
            await schedule();
            last = Date.now();
          }
        }
        post({ ...base(cmd), type: 'runComplete', lastCycle: cmd.toCycle, diagnostics: snapshotDiag() });
        return;
      }

      case 'requestCycle': {
        if (!appliedConfig) {
          post({ ...base(cmd), type: 'error', code: 'internal', message: 'configure first', recoverable: true });
          return;
        }
        run.reset();
        let out = run.computeCycle(1, 'frames');
        for (let c = 2; c <= cmd.cycle; c++) {
          if (out.status === 'diverged') break;
          out = run.computeCycle(c, 'frames');
        }
        if (out.status === 'diverged' && out.divergence) {
          post({
            ...base(cmd),
            type: 'diverged',
            cycle: cmd.cycle,
            stepId: out.divergence.stepId,
            reason: out.divergence.reason,
            detail: out.divergence.detail,
          });
          return;
        }
        post({ ...base(cmd), type: 'cycleFrames', cycle: cmd.cycle, frames: out.frames ?? [], diag: out.diag });
        return;
      }

      case 'cancel':
        latestEpoch = Math.max(latestEpoch, cmd.epoch);
        return;

      case 'dispose':
        run.reset();
        appliedConfig = null;
        resetDiag();
        return;
    }
  }

  return { handle };
}
