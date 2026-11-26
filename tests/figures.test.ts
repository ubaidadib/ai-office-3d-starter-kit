import { describe, expect, it } from 'vitest';
import { movementActive, useOffice } from '../src/store';

describe('Hide-figures switch', () => {
  it('stops all simulated movement', () => {
    expect(movementActive({ figuresHidden: true, movementPaused: false })).toBe(false);
    expect(movementActive({ figuresHidden: true, movementPaused: true })).toBe(false);
  });
  it('pause also stops movement; movement runs only when both are off', () => {
    expect(movementActive({ figuresHidden: false, movementPaused: true })).toBe(false);
    expect(movementActive({ figuresHidden: false, movementPaused: false })).toBe(true);
  });
  it('the store starts with the figures shown and toggles cleanly', () => {
    const s = useOffice.getState();
    expect(s.figuresHidden).toBe(false);
    s.setFiguresHidden(true);
    expect(movementActive(useOffice.getState())).toBe(false);
    useOffice.getState().setFiguresHidden(false);
    expect(movementActive(useOffice.getState())).toBe(true);
  });
});

describe('Hidden figures also block selection and follow of the simulated figure', () => {
  it('cannot select or follow the figure while hidden; hiding them clears both', () => {
    const s = useOffice.getState();
    s.setFiguresHidden(false);
    s.select({ kind: 'figure' }); s.setFollow(true);
    expect(useOffice.getState().follow).toBe(true);
    useOffice.getState().setFiguresHidden(true);
    expect(useOffice.getState().follow).toBe(false);
    expect(useOffice.getState().selection).toBeNull();
    useOffice.getState().select({ kind: 'figure' }); useOffice.getState().setFollow(true);
    expect(useOffice.getState().follow).toBe(false);
    expect(useOffice.getState().selection).toBeNull();
    useOffice.getState().setFiguresHidden(false);
  });
});
