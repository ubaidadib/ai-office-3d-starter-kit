// DOM labels over the 3D view (crisp text, no textures). Positions are set by LabelProjector.
// One label per role figure. In developer mode each carries the SIMULATED pill; in
// presentation mode the single on-screen disclosure covers all of them (see ui/PresentHud.tsx).
import { PRIORITY, STATIC_LABELS, employeeLabelId, type LabelDef } from '../labels';
import { ACTORS, ACTOR_IDS } from '../model/cast';
import { DEV } from '../mode';
import { ui } from '../i18n';
import { useOffice } from '../store';

/** id → element, filled by ref callbacks and read by the projector. */
export const labelElements = new Map<string, HTMLElement>();

export const EMPLOYEE_LABELS: LabelDef[] = ACTOR_IDS.map((id) => ({
  id: employeeLabelId(id), kind: 'employee', text: DEV ? ACTORS[id].display : ACTORS[id].chip, pill: DEV ? ui('simulated') : undefined,
  sub: DEV ? ui('notAiActivity') : undefined, priority: PRIORITY.employee, detailAt: 1.8, dynamic: true,
  accent: ACTORS[id].accent,
}));
/** The label of the `admissions` slot figure (used by diagnostics). */
export const EMPLOYEE_LABEL: LabelDef = EMPLOYEE_LABELS[ACTOR_IDS.indexOf('admissions')];

function Label({ def, onClick }: { def: LabelDef; onClick?: () => void }) {
  return (
    <div ref={(el) => { if (el) labelElements.set(def.id, el); else labelElements.delete(def.id); }}
      className={`label label-${def.kind}`} data-detail="false" data-selected="false" data-text={def.text + (def.pill ? ' ' + def.pill : '')}
      style={{ visibility: 'hidden', ['--accent' as string]: def.accent ?? '#9aa0a8' }}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={def.text + (def.pill ? ` (${def.pill})` : '')}>
      <span className="label-main">{def.text}{def.pill && <span className="label-pill">{def.pill}</span>}</span>
      {def.sub && <span className="label-sub">{def.sub}</span>}
    </div>
  );
}

export function LabelLayer() {
  const command = useOffice((s) => s.command);
  return (
    <div className="label-layer" aria-label="Room and role labels">
      {STATIC_LABELS.map((d) => (
        <Label key={d.id} def={d} onClick={d.roomId ? () => command({ type: 'room', id: d.roomId! }) : undefined} />
      ))}
      {EMPLOYEE_LABELS.map((d, i) => <Label key={d.id} def={d} onClick={() => command({ type: 'figure', id: ACTOR_IDS[i] })} />)}
    </div>
  );
}
