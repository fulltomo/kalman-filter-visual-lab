import type { Config, SubStepFrame, Diagnostics, Warning, Phase, CycleDiag } from '../core/types';

export const PROTOCOL_VERSION = 1;

export interface Envelope {
  protocol: number;
  id: string;
  epoch: number;
}

/** Command payloads without the transport envelope (so they compose cleanly). */
export type CommandBody =
  | { type: 'init' }
  | { type: 'configure'; config: Config }
  | { type: 'run'; fromCycle: number; toCycle: number; emit: 'frames' | 'diagnosticsOnly' }
  | { type: 'requestCycle'; cycle: number }
  | { type: 'cancel'; targetEpoch: number }
  | { type: 'dispose' };

export type Command = Envelope & CommandBody;

export type WorkerEvent = Envelope &
  (
    | { type: 'ready'; protocol: number }
    | {
        type: 'configured';
        dims: { N: number; k: number; m: number };
        appliedConfig: Config;
        warnings: Warning[];
      }
    | { type: 'progress'; cycle: number; total: number; phase: Phase }
    | { type: 'cycleFrames'; cycle: number; frames: SubStepFrame[]; diag: CycleDiag }
    | { type: 'runComplete'; lastCycle: number; diagnostics: Diagnostics }
    | { type: 'diverged'; cycle: number; stepId: string; reason: string; detail: string }
    | { type: 'warning'; code: string; message: string }
    | { type: 'error'; code: string; message: string; recoverable: boolean }
    | { type: 'cancelled'; epoch: number; atCycle: number }
  );

let counter = 0;
/** Unique request id (monotonic counter + random suffix; no crypto dependency). */
export function makeId(): string {
  counter = (counter + 1) >>> 0;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
