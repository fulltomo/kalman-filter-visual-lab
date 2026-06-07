import type { SubStepFrame } from '../core/types';
import { Equation } from './Equation';

export function Inspector({ frame }: { frame: SubStepFrame | null }) {
  if (!frame) return <div className="inspector">サイクルを実行してください。</div>;
  return (
    <div className="inspector">
      <div className="inspector-head">
        <strong>{frame.title}</strong>
        <span className="muted">
          Cycle {frame.cycle}・{frame.phase === 'forecast' ? '予報' : '解析'}・{frame.index + 1}
        </span>
      </div>
      <Equation latex={frame.equationLatex} />
      <p className="description">{frame.description}</p>
      <ul className="quantities">
        {frame.snapshot.map((q) => (
          <li key={q.role}>
            <code>{q.label}</code>{' '}
            <span className="muted">
              {q.rows}×{q.cols}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
