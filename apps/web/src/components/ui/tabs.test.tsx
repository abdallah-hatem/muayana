import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsList, TabsTrigger } from './tabs';

function renderTabs() {
  render(
    <Tabs defaultValue="a">
      <TabsList aria-label="views">
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
    </Tabs>,
  );
}

describe('TabsTrigger focus ring', () => {
  it('a tapped tab is marked as pointer-focused, so it gets no keyboard ring', async () => {
    renderTabs();
    const b = screen.getByRole('tab', { name: 'B' });
    await userEvent.setup().click(b);
    expect(b).toHaveAttribute('aria-selected', 'true');
    expect(b).toHaveFocus();
    expect(b).toHaveAttribute('data-pointer-focus');
  });

  it('a key press after the tap clears the mark (keyboard focus shows the ring again)', async () => {
    renderTabs();
    const b = screen.getByRole('tab', { name: 'B' });
    await userEvent.setup().click(b);
    fireEvent.keyDown(b, { key: 'ArrowLeft' });
    expect(b).not.toHaveAttribute('data-pointer-focus');
  });

  it('leaving the tab clears the mark', async () => {
    renderTabs();
    const b = screen.getByRole('tab', { name: 'B' });
    await userEvent.setup().click(b);
    fireEvent.blur(b);
    expect(b).not.toHaveAttribute('data-pointer-focus');
  });
});
