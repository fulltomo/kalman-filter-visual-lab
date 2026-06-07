import { describe, it, expect } from 'vitest';
import { PlaybackEngine } from './playbackEngine';
import type { SubStepFrame } from '../core/types';

// A fake loader returning `subSteps` frames per cycle, recording requests.
function fakeLoader(subSteps = 8) {
  const requested: number[] = [];
  const load = async (cycle: number): Promise<SubStepFrame[]> => {
    requested.push(cycle);
    return Array.from({ length: subSteps }, (_, i) => ({
      cycle,
      phase: i < 3 ? 'forecast' : 'analysis',
      stepId: `s${i}`,
      index: i,
      title: `step ${i}`,
      equationLatex: '',
      highlightTerms: [],
      description: '',
      snapshot: [],
    })) as SubStepFrame[];
  };
  return { load, requested };
}

describe('PlaybackEngine', () => {
  it('loads and exposes the current frame after seek', async () => {
    const { load } = fakeLoader();
    const pb = new PlaybackEngine({ load, totalCycles: 5, cacheSize: 3 });
    await pb.seek(2, 0);
    expect(pb.state.cycle).toBe(2);
    expect(pb.state.subIndex).toBe(0);
    expect(pb.currentFrame()?.stepId).toBe('s0');
  });

  it('steps forward across the cycle boundary', async () => {
    const { load } = fakeLoader(3);
    const pb = new PlaybackEngine({ load, totalCycles: 5, cacheSize: 3 });
    await pb.seek(1, 2); // last sub-step of cycle 1
    await pb.stepForward();
    expect(pb.state.cycle).toBe(2);
    expect(pb.state.subIndex).toBe(0);
  });

  it('steps backward across the cycle boundary', async () => {
    const { load } = fakeLoader(3);
    const pb = new PlaybackEngine({ load, totalCycles: 5, cacheSize: 3 });
    await pb.seek(2, 0);
    await pb.stepBackward();
    expect(pb.state.cycle).toBe(1);
    expect(pb.state.subIndex).toBe(2);
  });

  it('does not step before the first frame', async () => {
    const { load } = fakeLoader(3);
    const pb = new PlaybackEngine({ load, totalCycles: 5, cacheSize: 3 });
    await pb.seek(1, 0);
    await pb.stepBackward();
    expect(pb.state.cycle).toBe(1);
    expect(pb.state.subIndex).toBe(0);
  });

  it('evicts least-recently-used cycles beyond cacheSize', async () => {
    const { load, requested } = fakeLoader(2);
    const pb = new PlaybackEngine({ load, totalCycles: 10, cacheSize: 2 });
    await pb.seek(1, 0);
    await pb.seek(2, 0);
    await pb.seek(3, 0); // evicts cycle 1
    requested.length = 0;
    await pb.seek(3, 0); // cached, no reload
    expect(requested).toEqual([]);
    await pb.seek(1, 0); // evicted, reloaded
    expect(requested).toEqual([1]);
  });

  it('notifies subscribers on state change', async () => {
    const { load } = fakeLoader();
    const pb = new PlaybackEngine({ load, totalCycles: 5, cacheSize: 3 });
    let count = 0;
    pb.subscribe(() => count++);
    await pb.seek(2, 1);
    expect(count).toBeGreaterThan(0);
  });

  it('play advances sub-steps on each timer tick and pauses at the end', async () => {
    const { load } = fakeLoader(2);
    let cb: (() => void | Promise<void>) | null = null;
    const timer = {
      start: (fn: () => void | Promise<void>) => {
        cb = fn;
      },
      stop: () => {
        cb = null;
      },
    };
    const pb = new PlaybackEngine({ load, totalCycles: 2, cacheSize: 4, timer });
    await pb.seek(1, 0);
    pb.play();
    // 4 frames total (2 cycles × 2 sub-steps); advance to the end.
    for (let i = 0; i < 10 && cb; i++) await cb();
    expect(pb.state.cycle).toBe(2);
    expect(pb.state.subIndex).toBe(1);
    expect(pb.state.playing).toBe(false);
  });
});
