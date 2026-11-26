import { ROOMS } from '../model/floorplan';
import { useOffice } from '../store';

const ORDER = ['reception', 'founder_office', 'coo_office', 'marketing_office', 'admissions_office', 'bizdev_office',
  'marketing_studio', 'admissions_library', 'bizdev_pipeline', 'meeting_room', 'boardroom', 'lounge', 'archive'];

export function NavPanel() {
  const { command, follow, figuresHidden, selection, setFollow, startTour, tourId, endTour } = useOffice();
  const rooms = ORDER.map((id) => ROOMS.find((r) => r.id === id)!).filter(Boolean);
  const current = selection?.kind === 'room' ? selection.id : '';
  return (
    <div className="panel nav" role="toolbar" aria-label="Navigation">
      <button type="button" onClick={() => command({ type: 'overview' })} title="Overview (H)">⌂ Overview</button>
      <select aria-label="Go to room" value={current} onChange={(e) => e.target.value && command({ type: 'room', id: e.target.value })}>
        <option value="">Go to room…</option>
        {rooms.map((r) => <option key={r.id} value={r.id}>{r.nameplate ? `${r.name} — ${r.nameplate}` : r.name}</option>)}
      </select>
      <div className="btn-group">
        <button type="button" onClick={() => command({ type: 'rotate', dir: -1 })} title="Rotate left (Q)" aria-label="Rotate left">⟲</button>
        <button type="button" onClick={() => command({ type: 'rotate', dir: 1 })} title="Rotate right (E)" aria-label="Rotate right">⟳</button>
        <button type="button" onClick={() => command({ type: 'zoom', factor: 0.8 })} title="Zoom out (−)" aria-label="Zoom out">−</button>
        <button type="button" onClick={() => command({ type: 'zoom', factor: 1.25 })} title="Zoom in (+)" aria-label="Zoom in">+</button>
      </div>
      <button type="button" disabled={figuresHidden} aria-pressed={follow}
        onClick={() => (follow ? setFollow(false) : command({ type: 'figure' }))}
        title={figuresHidden ? 'Not available while the figures are hidden' : 'Follow the SIMULATED figure (F)'}>
        {follow ? '◉ Following (SIMULATED)' : '○ Follow figure'}
      </button>
      <button type="button" disabled={figuresHidden} onClick={() => (tourId ? endTour() : startTour('full'))} title="Guided camera tour (T). Staged, SIMULATED movement.">
        {tourId ? '■ Stop tour' : '▶ Guided tour'}
      </button>
    </div>
  );
}
