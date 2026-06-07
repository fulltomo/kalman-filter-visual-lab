/// <reference lib="webworker" />
import { createWorkerCore } from './workerCore';
import type { Command } from './protocol';

const core = createWorkerCore((e) => (self as DedicatedWorkerGlobalScope).postMessage(e));

self.onmessage = (ev: MessageEvent<Command>) => {
  void core.handle(ev.data);
};
