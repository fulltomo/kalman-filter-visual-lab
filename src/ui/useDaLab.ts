import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultConfig,
  type Config,
  type Diagnostics,
  type SubStepFrame,
  type Warning,
} from '../core/types';
import { DaWorkerClient, type Port } from '../worker/client';
import type { WorkerEvent } from '../worker/protocol';
import { PlaybackEngine } from '../playback/playbackEngine';

function makeWorkerPort(): Port {
  const worker = new Worker(new URL('../worker/daWorker.ts', import.meta.url), { type: 'module' });
  return {
    post: (cmd) => worker.postMessage(cmd),
    set onmessage(cb: (e: WorkerEvent) => void) {
      worker.onmessage = (ev: MessageEvent<WorkerEvent>) => cb(ev.data);
    },
  };
}

const EMPTY_DIAG: Diagnostics = { cycles: [], rmseAnalysis: [], rmseForecast: [], spread: [] };

export interface DaLab {
  config: Config;
  setConfig: (c: Config) => void;
  apply: () => Promise<void>;
  warnings: Warning[];
  diagnostics: Diagnostics;
  frame: SubStepFrame | null;
  state: { cycle: number; subIndex: number; playing: boolean; speed: number };
  totalCycles: number;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seek: (cycle: number, subIndex: number) => void;
  setSpeed: (s: number) => void;
}

export function useDaLab(): DaLab {
  const clientRef = useRef<DaWorkerClient | null>(null);
  const pbRef = useRef<PlaybackEngine | null>(null);
  const [config, setConfig] = useState<Config>(defaultConfig());
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(EMPTY_DIAG);
  const [frame, setFrame] = useState<SubStepFrame | null>(null);
  const [totalCycles, setTotalCycles] = useState(0);
  const [, force] = useState(0);

  useEffect(() => {
    const client = new DaWorkerClient(makeWorkerPort());
    clientRef.current = client;
    void client.init();
    return () => {
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);

  const apply = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const collected: Diagnostics = { cycles: [], rmseAnalysis: [], rmseForecast: [], spread: [] };
    const off = client.onEvent((e: WorkerEvent) => {
      if (e.type === 'configured') setWarnings(e.warnings);
      if (e.type === 'cycleFrames') {
        collected.cycles.push(e.cycle);
        collected.rmseAnalysis.push(e.diag.rmseAnalysis);
        collected.rmseForecast.push(e.diag.rmseForecast);
        collected.spread.push(e.diag.spread);
        setDiagnostics({
          cycles: [...collected.cycles],
          rmseAnalysis: [...collected.rmseAnalysis],
          rmseForecast: [...collected.rmseForecast],
          spread: [...collected.spread],
        });
      }
    });
    setDiagnostics(EMPTY_DIAG);
    await client.configure(config);
    setTotalCycles(config.maxCycles);
    const pb = new PlaybackEngine({
      load: async (cycle) => (await client.requestCycle(cycle)).frames,
      totalCycles: config.maxCycles,
      cacheSize: 8,
    });
    pb.subscribe(() => {
      setFrame(pb.currentFrame());
      force((n) => n + 1);
    });
    pbRef.current = pb;
    await client.run(1, config.maxCycles, 'diagnosticsOnly');
    off();
    await pb.seek(1, 0);
  }, [config]);

  const pb = () => pbRef.current;
  return {
    config,
    setConfig,
    apply,
    warnings,
    diagnostics,
    frame,
    state: pb()?.state ?? { cycle: 1, subIndex: 0, playing: false, speed: 4 },
    totalCycles,
    play: () => pb()?.play(),
    pause: () => pb()?.pause(),
    stepForward: () => void pb()?.stepForward(),
    stepBackward: () => void pb()?.stepBackward(),
    seek: (c, s) => void pb()?.seek(c, s),
    setSpeed: (s) => pb()?.setSpeed(s),
  };
}
