// Label declutter: keep higher-priority labels, hide lower-priority ones that would overlap.
export interface LabelBox { id: string; x: number; y: number; w: number; h: number; priority: number }

export const overlaps = (a: LabelBox, b: LabelBox, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Greedy by priority (ties keep input order). Returns the ids that stay visible. */
export function declutter(boxes: LabelBox[], pad = 4): Set<string> {
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => q.b.priority - p.b.priority || p.i - q.i);
  const kept: LabelBox[] = [];
  for (const { b } of order) if (!kept.some((k) => overlaps(k, b, pad))) kept.push(b);
  return new Set(kept.map((k) => k.id));
}

/** Count overlapping pairs among visible boxes (used by tests and the gate script). */
export function overlapCount(boxes: LabelBox[], pad = 0): number {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j], pad)) n++;
  return n;
}
