export function InnovationBars({ data, height = 120 }: { data: Float64Array; height?: number }) {
  const max = Math.max(1e-9, ...Array.from(data, (v) => Math.abs(v)).filter(Number.isFinite));
  return (
    <div
      className="innovation-bars"
      style={{ display: 'flex', alignItems: 'center', gap: 1, height }}
    >
      {Array.from(data, (v, i) => {
        const h = Number.isFinite(v) ? (Math.abs(v) / max) * (height / 2) : height / 2;
        return (
          <div
            key={i}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height }}
          >
            <div style={{ height: height / 2, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: 6, height: v > 0 ? h : 0, background: '#c81e1e' }} />
            </div>
            <div style={{ height: height / 2 }}>
              <div style={{ width: 6, height: v < 0 ? h : 0, background: '#1e3cc8' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
