import type { Config } from '../core/types';
import {
  PROTOCOL_VERSION,
  makeId,
  type Command,
  type CommandBody,
  type WorkerEvent,
} from './protocol';

/** Minimal transport: send a Command, receive WorkerEvents. */
export interface Port {
  post(cmd: Command): void;
  set onmessage(cb: (e: WorkerEvent) => void);
}

type Listener = (e: WorkerEvent) => void;

export interface ConfiguredInfo {
  dims: { N: number; k: number; m: number };
}

export class DaWorkerClient {
  private epoch = 0;
  private listeners = new Set<Listener>();

  constructor(private port: Port) {
    this.port.onmessage = (e) => this.dispatch(e);
  }

  private dispatch(e: WorkerEvent): void {
    if (e.protocol !== PROTOCOL_VERSION) {
      for (const l of this.listeners) {
        l({
          protocol: PROTOCOL_VERSION,
          id: e.id,
          epoch: e.epoch,
          type: 'error',
          code: 'protocolMismatch',
          message: 'ワーカーのプロトコルが一致しません。ページを再読み込みしてください。',
          recoverable: false,
        });
      }
      return;
    }
    for (const l of this.listeners) l(e);
  }

  /** Subscribe to all worker events. Returns an unsubscribe fn. */
  onEvent(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Send a command, resolving when an event with a matching id and matching type predicate arrives. */
  private send<T extends WorkerEvent>(
    cmd: CommandBody,
    done: (e: WorkerEvent) => e is T,
  ): Promise<T> {
    const id = makeId();
    const full = { protocol: PROTOCOL_VERSION, id, epoch: this.epoch, ...cmd } as Command;
    return new Promise<T>((resolve, reject) => {
      const off = this.onEvent((e) => {
        if (e.id !== id) return;
        if (done(e)) {
          off();
          resolve(e);
        } else if (e.type === 'error') {
          off();
          reject(new Error(`${e.code}: ${e.message}`));
        }
      });
      this.port.post(full);
    });
  }

  init(): Promise<void> {
    return this.send(
      { type: 'init' },
      (e): e is Extract<WorkerEvent, { type: 'ready' }> => e.type === 'ready',
    ).then(() => undefined);
  }

  configure(config: Config): Promise<ConfiguredInfo> {
    this.epoch += 1;
    return this.send(
      { type: 'configure', config },
      (e): e is Extract<WorkerEvent, { type: 'configured' }> => e.type === 'configured',
    ).then((e) => ({ dims: e.dims }));
  }

  run(fromCycle: number, toCycle: number, emit: 'frames' | 'diagnosticsOnly'): Promise<void> {
    return this.send(
      { type: 'run', fromCycle, toCycle, emit },
      (e): e is Extract<WorkerEvent, { type: 'runComplete' }> => e.type === 'runComplete',
    ).then(() => undefined);
  }

  requestCycle(cycle: number): Promise<Extract<WorkerEvent, { type: 'cycleFrames' }>> {
    return this.send(
      { type: 'requestCycle', cycle },
      (e): e is Extract<WorkerEvent, { type: 'cycleFrames' }> =>
        e.type === 'cycleFrames' && e.cycle === cycle,
    );
  }

  cancel(): void {
    this.epoch += 1;
    this.port.post({
      protocol: PROTOCOL_VERSION,
      id: makeId(),
      epoch: this.epoch,
      type: 'cancel',
      targetEpoch: this.epoch - 1,
    });
  }
}
