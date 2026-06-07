import { type Config, type Warning, type SubStepFrame, type CycleDiag, ConfigError } from './types';
import { validateConfig } from './validate';
import { buildExperiment, type Experiment } from './experiment';
import { estimateCost } from './perf';
import { makeEkf } from './filters/ekf';
import type { Filter, Emit } from './filters/types';

export interface ConfigureResult {
  dims: { N: number; k: number; m: number };
  appliedConfig: Config;
  warnings: Warning[];
}

export interface ComputeResult {
  frames?: SubStepFrame[];
  diag: CycleDiag;
  status: 'ok' | 'diverged';
  divergence?: { stepId: string; reason: string; detail: string };
}

/** Pure, synchronous orchestrator. Cycles must be requested in order. */
export class DaRun {
  private filter: Filter | null = null;
  private experiment: Experiment | null = null;
  private current = 0; // last completed cycle

  configure(raw: Config): ConfigureResult {
    const { config, warnings, errors } = validateConfig(raw);
    if (errors.length) throw new ConfigError('invalidConfig', errors.join('; '));

    if (config.method !== 'ekf') {
      throw new ConfigError('invalidConfig', `method "${config.method}" は本ビルドでは未実装です。`);
    }

    const experiment = buildExperiment(config);
    const cost = estimateCost(config);
    if (cost.tier !== 'green') warnings.push({ code: 'heavyConfig', message: cost.message });

    this.experiment = experiment;
    this.filter = makeEkf(experiment, config);
    this.current = 0;

    return {
      dims: { N: config.N, k: config.k, m: experiment.m },
      appliedConfig: config,
      warnings,
    };
  }

  computeCycle(cycle: number, emit: Emit): ComputeResult {
    if (!this.filter) throw new Error('DaRun: call configure() before computeCycle().');
    if (cycle !== this.current + 1) {
      throw new Error(
        `DaRun: cycles must be sequential (expected ${this.current + 1}, got ${cycle}).`,
      );
    }
    const out = this.filter.step(cycle, emit);
    if (out.status === 'ok') this.current = cycle;
    return {
      frames: emit === 'frames' ? out.frames : undefined,
      diag: out.diag,
      status: out.status,
      divergence: out.divergence,
    };
  }

  reset(): void {
    this.current = 0;
    this.filter?.reset();
  }
}
