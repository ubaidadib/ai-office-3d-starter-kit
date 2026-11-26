import { describe, expect, it } from 'vitest';
import { declutter, overlapCount, overlaps, type LabelBox } from '../src/model/declutter';
import { PRIORITY, STATIC_LABELS } from '../src/labels';

const box = (id: string, x: number, y: number, priority: number, w = 100, h = 20): LabelBox => ({ id, x, y, w, h, priority });

describe('label declutter (A10)', () => {
  it('keeps non-overlapping labels', () => {
    expect([...declutter([box('a', 0, 0, 1), box('b', 200, 0, 1)])].sort()).toEqual(['a', 'b']);
  });
  it('hides the lower-priority label of an overlapping pair', () => {
    const keep = declutter([box('room', 0, 0, PRIORITY.room), box('emp', 50, 5, PRIORITY.employee)]);
    expect(keep.has('emp')).toBe(true);
    expect(keep.has('room')).toBe(false);
  });
  it('the employee tag is never hidden by any other label', () => {
    const boxes = [box('emp', 100, 100, PRIORITY.employee), ...Array.from({ length: 20 }, (_, i) => box('r' + i, 90 + i, 95 + i, PRIORITY.office + PRIORITY.selected))];
    expect(declutter(boxes).has('emp')).toBe(true);
  });
  it('result never contains overlapping boxes', () => {
    const boxes = Array.from({ length: 60 }, (_, i) => box('l' + i, (i * 37) % 300, (i * 53) % 200, i % 5));
    const keep = declutter(boxes, 4);
    expect(overlapCount(boxes.filter((b) => keep.has(b.id)), 4)).toBe(0);
  });
  it('padding is respected', () => {
    expect(overlaps(box('a', 0, 0, 1), box('b', 102, 0, 1), 4)).toBe(true);
    expect(overlaps(box('a', 0, 0, 1), box('b', 102, 0, 1), 0)).toBe(false);
  });
  it('labels have the required priority order', () => {
    expect(PRIORITY.employee).toBeGreaterThan(PRIORITY.office + PRIORITY.selected);
    expect(PRIORITY.office).toBeGreaterThan(PRIORITY.room);
    for (const l of STATIC_LABELS) expect(l.text).not.toMatch(/SIMULATED|LIVE/);   // static signage carries no provenance claims
  });
});
