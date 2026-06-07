// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Equation } from './Equation';

describe('Equation', () => {
  it('renders KaTeX markup for a formula', () => {
    const { container } = render(<Equation latex={'K = P^f H^\\top S^{-1}'} />);
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('renders nothing problematic for an empty formula', () => {
    const { container } = render(<Equation latex="" />);
    expect(container).toBeTruthy();
  });
});
