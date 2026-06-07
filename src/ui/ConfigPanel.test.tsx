// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { defaultConfig } from '../core/types';
import { ConfigPanel } from './ConfigPanel';

describe('ConfigPanel', () => {
  it('shows N and calls onChange when edited', () => {
    const onChange = vi.fn();
    render(
      <ConfigPanel config={defaultConfig()} onChange={onChange} onApply={() => {}} onReset={() => {}} />,
    );
    const n = screen.getByLabelText('N') as HTMLInputElement;
    expect(n.value).toBe('40');
    fireEvent.change(n, { target: { value: '64' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('fires onApply when the Apply button is clicked', () => {
    const onApply = vi.fn();
    render(
      <ConfigPanel config={defaultConfig()} onChange={() => {}} onApply={onApply} onReset={() => {}} />,
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalled();
  });
});
