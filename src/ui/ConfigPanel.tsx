import type { Config } from '../core/types';

type NumKey =
  | 'N'
  | 'F'
  | 'dt'
  | 'assimInterval'
  | 'sigmaObs'
  | 'k'
  | 'rho'
  | 'locRadius'
  | 'Q'
  | 'seed'
  | 'maxCycles';

const FIELDS: { key: NumKey; label: string; step?: number }[] = [
  { key: 'N', label: 'N' },
  { key: 'F', label: 'F' },
  { key: 'dt', label: 'dt', step: 0.01 },
  { key: 'assimInterval', label: '同化間隔', step: 0.01 },
  { key: 'sigmaObs', label: 'σ_obs', step: 0.1 },
  { key: 'k', label: 'k' },
  { key: 'rho', label: 'ρ (インフレ)', step: 0.01 },
  { key: 'locRadius', label: '局所化半径' },
  { key: 'Q', label: 'Q', step: 0.01 },
  { key: 'seed', label: 'seed' },
  { key: 'maxCycles', label: '最大サイクル' },
];

export function ConfigPanel({
  config,
  onChange,
  onApply,
  onReset,
}: {
  config: Config;
  onChange: (c: Config) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="config-panel">
      <h2>設定</h2>
      {FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          <input
            aria-label={f.label}
            type="number"
            step={f.step ?? 1}
            value={config[f.key]}
            onChange={(e) => onChange({ ...config, [f.key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <label className="field">
        <span>観測被覆</span>
        <select
          aria-label="観測被覆"
          value={config.coverage}
          onChange={(e) => onChange({ ...config, coverage: e.target.value as Config['coverage'] })}
        >
          <option value="all">全て</option>
          <option value="sparse">1つおき</option>
          <option value="custom">カスタム</option>
        </select>
      </label>
      <div className="actions">
        <button onClick={onApply}>Apply</button>
        <button onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
