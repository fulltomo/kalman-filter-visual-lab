// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Heatmap } from './Heatmap';
import type { NamedQuantity } from '../../core/types';

const q: NamedQuantity = {
  role: 'P_a',
  label: 'P^a',
  kind: 'matrix',
  rows: 2,
  cols: 2,
  data: Float64Array.from([1, 0.2, 0.2, 1]),
};

describe('Heatmap', () => {
  it('renders a canvas for a matrix quantity', () => {
    const { container } = render(<Heatmap quantity={q} />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
