import type { SubStepFrame } from '../core/types';

export interface PlaybackState {
  cycle: number;
  subIndex: number;
  playing: boolean;
  speed: number; // sub-steps per second (advisory; the timer owns cadence)
}

export interface PlaybackTimer {
  start(tick: () => void | Promise<void>): void;
  stop(): void;
}

export interface PlaybackOptions {
  load: (cycle: number) => Promise<SubStepFrame[]>;
  totalCycles: number;
  cacheSize: number;
  timer?: PlaybackTimer;
}

function defaultTimer(getSpeed: () => number): PlaybackTimer {
  let handle: ReturnType<typeof setInterval> | null = null;
  return {
    start(tick) {
      const ms = Math.max(16, 1000 / Math.max(0.1, getSpeed()));
      handle = setInterval(() => void tick(), ms);
    },
    stop() {
      if (handle !== null) clearInterval(handle);
      handle = null;
    },
  };
}

export class PlaybackEngine {
  state: PlaybackState = { cycle: 1, subIndex: 0, playing: false, speed: 4 };

  private load: PlaybackOptions['load'];
  private totalCycles: number;
  private cacheSize: number;
  private timer: PlaybackTimer;
  private cache = new Map<number, SubStepFrame[]>(); // insertion-ordered ⇒ LRU
  private subs = new Set<() => void>();

  constructor(opts: PlaybackOptions) {
    this.load = opts.load;
    this.totalCycles = opts.totalCycles;
    this.cacheSize = opts.cacheSize;
    this.timer = opts.timer ?? defaultTimer(() => this.state.speed);
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  private emit(): void {
    for (const cb of this.subs) cb();
  }

  private async frames(cycle: number): Promise<SubStepFrame[]> {
    const hit = this.cache.get(cycle);
    if (hit) {
      this.cache.delete(cycle); // refresh recency
      this.cache.set(cycle, hit);
      return hit;
    }
    const loaded = await this.load(cycle);
    this.cache.set(cycle, loaded);
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value as number;
      this.cache.delete(oldest);
    }
    return loaded;
  }

  currentFrame(): SubStepFrame | null {
    const f = this.cache.get(this.state.cycle);
    return f ? (f[this.state.subIndex] ?? null) : null;
  }

  async seek(cycle: number, subIndex: number): Promise<void> {
    const c = Math.min(this.totalCycles, Math.max(1, cycle));
    const f = await this.frames(c);
    this.state.cycle = c;
    this.state.subIndex = Math.min(f.length - 1, Math.max(0, subIndex));
    this.emit();
  }

  async stepForward(): Promise<void> {
    const f = await this.frames(this.state.cycle);
    if (this.state.subIndex < f.length - 1) {
      this.state.subIndex += 1;
      this.emit();
      return;
    }
    if (this.state.cycle < this.totalCycles) {
      await this.seek(this.state.cycle + 1, 0);
      return;
    }
    this.pause(); // at the very end
  }

  async stepBackward(): Promise<void> {
    if (this.state.subIndex > 0) {
      this.state.subIndex -= 1;
      this.emit();
      return;
    }
    if (this.state.cycle > 1) {
      const prev = await this.frames(this.state.cycle - 1);
      this.state.cycle -= 1;
      this.state.subIndex = prev.length - 1;
      this.emit();
    }
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    this.emit();
  }

  play(): void {
    if (this.state.playing) return;
    this.state.playing = true;
    this.emit();
    this.timer.start(async () => {
      const atEnd =
        this.state.cycle >= this.totalCycles &&
        this.state.subIndex >= (this.cache.get(this.state.cycle)?.length ?? 1) - 1;
      if (atEnd) {
        this.pause();
        return;
      }
      await this.stepForward();
    });
  }

  pause(): void {
    if (!this.state.playing) return;
    this.state.playing = false;
    this.timer.stop();
    this.emit();
  }
}
