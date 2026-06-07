import { useEffect, useRef } from 'react';
import type { NamedQuantity } from '../../core/types';
import { percentileAbs, symLogNorm, divergingColor } from '../../viz/colorScale';

export function Heatmap({ quantity, cell = 14 }: { quantity: NamedQuantity; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { rows, cols, data } = quantity;
    canvas.width = cols * cell;
    canvas.height = rows * cell;
    const scale = percentileAbs(data, 0.98);
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [cr, cg, cb] = divergingColor(symLogNorm(data[r * cols + c], scale));
        for (let y = 0; y < cell; y++) {
          for (let x = 0; x < cell; x++) {
            const px = ((r * cell + y) * canvas.width + (c * cell + x)) * 4;
            img.data[px] = cr;
            img.data[px + 1] = cg;
            img.data[px + 2] = cb;
            img.data[px + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [quantity, cell]);
  return <canvas ref={ref} className="heatmap" aria-label={quantity.label} />;
}
