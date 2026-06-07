import { defaultConfig, type Config } from '../core/types';

export interface Preset {
  name: string;
  config: Config;
}

export const PRESETS: Preset[] = [
  {
    name: '初学者 (N=10, 密観測)',
    config: { ...defaultConfig(), N: 10, coverage: 'all', k: 10, maxCycles: 100 },
  },
  { name: 'Classic (N=40, 疎)', config: { ...defaultConfig() } },
  { name: '階数不足デモ (N=40, 弱局所化)', config: { ...defaultConfig(), N: 40, k: 10, locRadius: 1 } },
];
