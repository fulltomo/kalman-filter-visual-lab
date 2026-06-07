import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../core/types';
import { createWorkerCore } from './workerCore';
import { DaWorkerClient, type Port } from './client';
import type { Command, WorkerEvent } from './protocol';

/** Bridge the client to an in-process worker core (no real Worker). */
function wiredClient() {
  let onmessage: ((e: WorkerEvent) => void) | null = null;
  const core = createWorkerCore(
    (e) => onmessage?.(e),
    () => Promise.resolve(),
  );
  const port: Port = {
    post: (cmd: Command) => void core.handle(cmd),
    set onmessage(cb: (e: WorkerEvent) => void) {
      onmessage = cb;
    },
  };
  return new DaWorkerClient(port);
}

describe('DaWorkerClient', () => {
  it('handshakes and reports ready', async () => {
    const client = wiredClient();
    await expect(client.init()).resolves.toBeUndefined();
  });

  it('configures and resolves with dims', async () => {
    const client = wiredClient();
    await client.init();
    const res = await client.configure({ ...defaultConfig(), N: 10, maxCycles: 3 });
    expect(res.dims).toEqual({ N: 10, k: 20, m: 5 });
  });

  it('streams cycle events to a listener during run', async () => {
    const client = wiredClient();
    await client.init();
    await client.configure({ ...defaultConfig(), N: 10, maxCycles: 4 });
    const cycles: number[] = [];
    client.onEvent((e) => {
      if (e.type === 'cycleFrames') cycles.push(e.cycle);
    });
    await client.run(1, 4, 'diagnosticsOnly');
    expect(cycles).toEqual([1, 2, 3, 4]);
  });

  it('requestCycle resolves with that cycle frames', async () => {
    const client = wiredClient();
    await client.init();
    await client.configure({ ...defaultConfig(), N: 10, maxCycles: 5 });
    const frames = await client.requestCycle(3);
    expect(frames.cycle).toBe(3);
    expect(frames.frames.length).toBe(8);
  });
});
