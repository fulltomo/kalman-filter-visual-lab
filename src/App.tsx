import { useMemo } from 'react';
import './ui/styles.css';
import { useDaLab } from './ui/useDaLab';
import { ConfigPanel } from './ui/ConfigPanel';
import { PlaybackBar } from './ui/PlaybackBar';
import { Inspector } from './ui/Inspector';
import { Heatmap } from './ui/panels/Heatmap';
import { InnovationBars } from './ui/panels/InnovationBars';
import { DiagnosticsChart } from './ui/panels/DiagnosticsChart';
import { PRESETS } from './ui/presets';

export function App() {
  const lab = useDaLab();
  const frame = lab.frame;

  const matrixOf = (role: string) =>
    frame?.snapshot.find((s) => s.role === role && s.kind === 'matrix');
  const vectorOf = (role: string) =>
    frame?.snapshot.find((s) => s.role === role && s.kind === 'vector');

  const positionLabel = useMemo(
    () =>
      frame
        ? `Cycle ${frame.cycle}・${frame.phase === 'forecast' ? '予報' : '解析'}・${frame.title}`
        : '—',
    [frame],
  );

  const cov = matrixOf('P_a') ?? matrixOf('P_f');
  const gain = matrixOf('K');
  const innov = vectorOf('innovation');

  return (
    <div className="app">
      <header className="topbar">
        <strong>Kalman Filter Visual Lab</strong>
        <span className="muted">手法: EKF</span>
        <select
          aria-label="プリセット"
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (p) lab.setConfig(p.config);
          }}
        >
          {PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
        {lab.warnings.length > 0 && (
          <span className="warnings">⚠ {lab.warnings.map((w) => w.message).join(' / ')}</span>
        )}
      </header>

      <ConfigPanel
        config={lab.config}
        onChange={lab.setConfig}
        onApply={lab.apply}
        onReset={() => lab.setConfig({ ...lab.config })}
      />

      <section className="panels">
        {cov && (
          <div className="panel">
            <h3>{cov.label} 共分散</h3>
            <Heatmap quantity={cov} />
          </div>
        )}
        {gain && (
          <div className="panel">
            <h3>ゲイン K</h3>
            <Heatmap quantity={gain} />
          </div>
        )}
        {innov && (
          <div className="panel">
            <h3>イノベーション d</h3>
            <InnovationBars data={innov.data} />
          </div>
        )}
        <div className="panel">
          <h3>診断時系列</h3>
          <DiagnosticsChart diagnostics={lab.diagnostics} />
        </div>
      </section>

      <div className="bottom">
        <Inspector frame={frame} />
        <div className="playback-area">
          <PlaybackBar
            cycle={lab.state.cycle}
            subIndex={lab.state.subIndex}
            playing={lab.state.playing}
            speed={lab.state.speed}
            totalCycles={lab.totalCycles}
            onPlay={lab.play}
            onPause={lab.pause}
            onStepBack={lab.stepBackward}
            onStepForward={lab.stepForward}
            onSeekCycle={(c) => lab.seek(c, 0)}
            onSpeed={lab.setSpeed}
            positionLabel={positionLabel}
          />
        </div>
      </div>
    </div>
  );
}
