import { useEffect, useRef } from 'react';

export interface StateSeries {
  label: string;
  color: string;
  data: Float64Array;
}

/** Overlay line plot of several length-N vectors (truth/forecast/analysis/obs). */
export function StateSpace({
  series,
  width = 480,
  height = 200,
}: {
  series: StateSeries[];
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series)
      for (const v of s.data)
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
    if (!Number.isFinite(lo)) {
      lo = -1;
      hi = 1;
    }
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
    const xOf = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * (width - 2) + 1);
    const yOf = (v: number) => height - ((v - lo) / (hi - lo)) * (height - 2) - 1;
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      s.data.forEach((v, i) => {
        const x = xOf(i, s.data.length);
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [series, width, height]);
  return <canvas ref={ref} className="state-space" />;
}
