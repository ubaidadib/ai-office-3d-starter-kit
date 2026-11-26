// Developer mode (?dev=1): navigation panels for building and checking the scene. English only.
import { useOffice } from '../store';
import { roomById } from '../model/floorplan';
import { NavPanel } from './NavPanel';
import { ACTORS } from '../model/cast';
import config from '../../office.config';
import { t } from '../i18n';

export function Hud() {
  const { figuresHidden, movementPaused, setFiguresHidden, setMovementPaused, selection, select, follow } = useOffice();
  return (
    <>
      <div className="banner" role="status">
        DEVELOPER MODE — the four figures follow a fixed, staged script. Their movement is SIMULATED and does not represent AI work.
      </div>
      <header className="topbar">
        <div>
          <h1>{t(config.company.name)} — {t(config.company.headquarters)}</h1>
          <div className="sub">AI Office 3D Starter Kit · developer mode · 30 × 22 m · remove ?dev=1 for presentation mode</div>
        </div>
      </header>

      <div className="panel controls">
        <label className="toggle">
          <input type="checkbox" checked={figuresHidden} onChange={(e) => setFiguresHidden(e.target.checked)} />
          <span>Hide figures</span>
        </label>
        <button type="button" disabled={figuresHidden} onClick={() => setMovementPaused(!movementPaused)}>
          {movementPaused ? 'Resume staged movement' : 'Pause staged movement'}
        </button>
      </div>

      <NavPanel />
      {selection && (
        <div className="panel selected" role="status">
          {selection.kind === 'room'
            ? <>Selected room: <b>{roomById(selection.id).name}</b>{roomById(selection.id).nameplate ? ` · ${roomById(selection.id).nameplate}` : ''}</>
            : <>Selected: <b>{ACTORS[selection.id ?? 'admissions'].display}</b> <span className="pill-sim">SIMULATED</span> staged movement{follow ? ' · following' : ''}</>}
          <button type="button" onClick={() => select(null)} aria-label="Clear selection">✕</button>
        </div>
      )}
      <div className="help">Drag or two-finger scroll to pan · pinch or scroll wheel to zoom · Q / E rotate · H overview · F follow · T tour · Esc clear</div>
    </>
  );
}
