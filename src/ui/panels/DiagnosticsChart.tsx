import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Diagnostics } from '../../core/types';

export function DiagnosticsChart({ diagnostics }: { diagnostics: Diagnostics }) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const data: uPlot.AlignedData = [
      Float64Array.from(diagnostics.cycles),
      Float64Array.from(diagnostics.rmseAnalysis),
      Float64Array.from(diagnostics.rmseForecast),
      Float64Array.from(diagnostics.spread),
    ];
    if (!plotRef.current) {
      plotRef.current = new uPlot(
        {
          width: 480,
          height: 200,
          scales: { x: { time: false } },
          series: [
            { label: 'cycle' },
            { label: 'RMSE(解析)', stroke: '#c81e1e' },
            { label: 'RMSE(予報)', stroke: '#1e3cc8' },
            { label: 'スプレッド', stroke: '#1e9e4e' },
          ],
        },
        data,
        ref.current,
      );
    } else {
      plotRef.current.setData(data);
    }
  }, [diagnostics]);
  useEffect(() => () => plotRef.current?.destroy(), []);
  return <div ref={ref} className="diagnostics-chart" />;
}
