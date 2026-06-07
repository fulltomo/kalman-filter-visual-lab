import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../core/types';
import { PROTOCOL_VERSION, type Command, type WorkerEvent } from './protocol';
import { createWorkerCore } from './workerCore';

function harness() {
  const events: WorkerEvent[] = [];
  const core = createWorkerCore(
    (e) => events.push(e),
    () => Promise.resolve(),
  );
  let n = 0;
  const cmd = (c: Omit<Command, 'protocol' | 'id' | 'epoch'> & { epoch?: number }): Command =>
    ({ protocol: PROTOCOL_VERSION, id: `c${n++}`, epoch: c.epoch ?? 1, ...c }) as Command;
  return { events, core, cmd };
}

describe('createWorkerCore', () => {
  it('replies to init with ready', async () => {
    const { events, core, cmd } = harness();
    await core.handle(cmd({ type: 'init' }));
    expect(events.at(-1)).toMatchObject({ type: 'ready', protocol: PROTOCOL_VERSION });
  });

  it('configures and reports dims', async () => {
    const { events, core, cmd } = harness();
    await core.handle(cmd({ type: 'configure', config: { ...defaultConfig(), N: 10, maxCycles: 3 } }));
    const configured = events.find((e) => e.type === 'configured');
    expect(configured).toMatchObject({ type: 'configured', dims: { N: 10, k: 20, m: 5 } });
  });

  it('emits an error event for an invalid config', async () => {
    const { events, core, cmd } = harness();
    await core.handle(cmd({ type: 'configure', config: { ...defaultConfig(), N: 2 } }));
    expect(events.some((e) => e.type === 'error' && e.code === 'invalidConfig')).toBe(true);
  });

  it('runs cycles emitting cycleFrames + runComplete with diagnostics', async () => {
    const { events, core, cmd } = harness();
    await core.handle(cmd({ type: 'configure', config: { ...defaultConfig(), N: 10, maxCycles: 5 } }));
    await core.handle(cmd({ type: 'run', fromCycle: 1, toCycle: 5, emit: 'diagnosticsOnly' }));
    const frames = events.filter((e) => e.type === 'cycleFrames');
    expect(frames.length).toBe(5);
    const done = events.find((e) => e.type === 'runComplete');
    expect(done).toBeTruthy();
    expect((done as Extract<WorkerEvent, { type: 'runComplete' }>).diagnostics.cycles).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('requestCycle re-derives frames for a single cycle', async () => {
    const { events, core, cmd } = harness();
    await core.handle(cmd({ type: 'configure', config: { ...defaultConfig(), N: 10, maxCycles: 5 } }));
    await core.handle(cmd({ type: 'requestCycle', cycle: 3 }));
    const cf = events.find((e) => e.type === 'cycleFrames') as Extract<
      WorkerEvent,
      { type: 'cycleFrames' }
    >;
    expect(cf.cycle).toBe(3);
    expect(cf.frames.length).toBe(8);
  });

  it('cancels a stale-epoch run immediately', async () => {
    const { events, core, cmd } = harness();
    await core.handle(
      cmd({ type: 'configure', config: { ...defaultConfig(), N: 10, maxCycles: 5 }, epoch: 2 }),
    );
    // a run tagged with an older epoch than the latest seen (2) must cancel
    await core.handle(
      cmd({ type: 'run', fromCycle: 1, toCycle: 5, emit: 'diagnosticsOnly', epoch: 1 }),
    );
    expect(events.some((e) => e.type === 'cancelled')).toBe(true);
    expect(events.filter((e) => e.type === 'cycleFrames').length).toBe(0);
  });
});
