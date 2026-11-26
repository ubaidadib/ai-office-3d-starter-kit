// Presentation-mode interface.
// A clean frame: a small brand lockup, ONE permanent disclosure line, a lower-third caption during a
// guided tour, opening and closing cards, and a control dock that hides itself. No developer panels.
import { useEffect, useRef, useState } from 'react';
import { ROOMS } from '../model/floorplan';
import { getTours } from '../model/tour';
import { useOffice } from '../store';
import { clock } from '../show';
import { AUTOPLAY, CLEAN, DISCLOSURE } from '../mode';
import config from '../../office.config';
import { otherLanguageHref, t, ui } from '../i18n';

const ORDER = ['reception', 'founder_office', 'coo_office', 'marketing_office', 'admissions_office', 'bizdev_office',
  'meeting_room', 'boardroom', 'marketing_studio', 'admissions_library', 'bizdev_pipeline', 'lounge', 'archive'];

const smooth = (u: number) => { const c = Math.min(1, Math.max(0, u)); return c * c * (3 - 2 * c); };

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/** Opening / closing cards. Opacity follows the tour clock directly (no React re-render per frame). */
function Cards() {
  const intro = useRef<HTMLDivElement>(null), outro = useRef<HTMLDivElement>(null), bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = useOffice.getState();
      let a = 0, b = 0, p = 0;
      if (!s.characterReady) a = 1;                       // the opening card doubles as the loading screen
      else if (s.tourId) {
        const tour = getTours()[s.tourId];
        a = 1 - smooth((clock.tour - (tour.intro - 0.9)) / 0.9);
        b = smooth((clock.tour - (tour.total - tour.outro)) / 1.0);
        p = Math.min(1, clock.tour / tour.total);
      }
      for (const [el, v] of [[intro.current, a], [outro.current, b]] as const) {
        if (!el) continue;
        el.style.opacity = String(v);
        el.style.visibility = v > 0.001 ? 'visible' : 'hidden';
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <div ref={intro} className="p-card" aria-hidden="true">
        <img src={config.brand.logo} alt="" />
        <div className="p-card-rule" />
        <div className="p-card-title">{t(config.company.headquarters)}</div>
        <div className="p-card-sub">{DISCLOSURE}</div>
      </div>
      <div ref={outro} className="p-card" aria-hidden="true" style={{ visibility: 'hidden', opacity: 0 }}>
        <img src={config.brand.logo} alt="" />
        <div className="p-card-rule" />
        <div className="p-card-title">{t(config.company.headquarters)}</div>
        <div className="p-card-sub">{t(config.closingLine)}</div>
      </div>
      {!CLEAN && <div className="p-progress"><div ref={bar} /></div>}
    </>
  );
}

export function PresentHud() {
  const { tourId, tourPaused, tourShot, startTour, endTour, toggleTourPause, command, labelsOn, setLabelsOn,
    movementPaused, setMovementPaused, characterReady } = useOffice();
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);

  // The dock and the cursor fade away after a few seconds without pointer movement.
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 2600);
    const wake = () => { setIdle(false); window.clearTimeout(timer); timer = window.setTimeout(() => setIdle(true), 2600); };
    window.addEventListener('pointermove', wake); window.addEventListener('pointerdown', wake);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    return () => { window.clearTimeout(timer); window.removeEventListener('pointermove', wake); window.removeEventListener('pointerdown', wake); document.removeEventListener('fullscreenchange', fs); };
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('p-idle', idle || CLEAN); }, [idle]);

  // ?autoplay=full|short starts a tour as soon as the scene is ready (repeatable recording set-up).
  const auto = useRef(false);
  useEffect(() => {
    if (characterReady && AUTOPLAY && !auto.current) { auto.current = true; startTour(AUTOPLAY); }
  }, [characterReady, startTour]);

  const tour = tourId ? getTours()[tourId] : null;
  const shot = tour ? tour.shots[tourShot] : null;
  const rooms = ORDER.map((id) => ROOMS.find((r) => r.id === id)!).filter(Boolean);

  return (
    <>
      <div className="p-brand" aria-label={`${t(config.company.name)} · ${t(config.company.headquarters)}`}>
        <img src={config.brand.mark} alt="" />
        <div><b>{t(config.company.name)}</b><span>{t(config.company.headquarters)}</span></div>
      </div>
      {/* The one disclosure. It is always on screen in presentation mode and cannot be switched off. */}
      <div className="p-disclosure" role="note">{DISCLOSURE}</div>
      {shot && shot.title && (
        <div key={tourId + ':' + tourShot} className="p-caption" style={{ animationDelay: tourShot === 0 && tour ? `${tour.intro}s` : '0.35s' }}>
          <b>{shot.title}</b>
          {shot.sub && <span>{shot.sub}</span>}
        </div>
      )}
      <Cards />
      {!CLEAN && (
        <div className={'p-dock' + (idle ? ' hide' : '')} role="toolbar" aria-label={ui('controls')}>
          {!tourId ? (
            <>
              <button type="button" className="gold" onClick={() => startTour('full')} title={ui('tipTour')}>{ui('tour')}</button>
              <button type="button" onClick={() => startTour('short')} title={ui('tipShort')}>{ui('shortCut')}</button>
              <button type="button" onClick={() => setMovementPaused(!movementPaused)} title={ui('tipMovement')}>{movementPaused ? ui('movementOff') : ui('movementOn')}</button>
              <button type="button" onClick={() => command({ type: 'overview' })} title={ui('tipOverview')}>⌂</button>
              <select aria-label={ui('goToRoom')} value="" onChange={(e) => e.target.value && command({ type: 'room', id: e.target.value })}>
                <option value="">{ui('goToRoom')}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>
          ) : (
            <>
              <button type="button" className="gold" onClick={toggleTourPause} title={ui('tipPause')}>{tourPaused ? ui('resume') : ui('pause')}</button>
              <button type="button" onClick={() => { clock.tour = 0; if (tourPaused) toggleTourPause(); }} title={ui('tipRestart')}>{ui('restart')}</button>
              <button type="button" onClick={endTour} title={ui('tipExit')}>{ui('exit')}</button>
              <span className="p-dock-info">{tour!.name} · {Math.round(tour!.total)} {ui('seconds')}</span>
            </>
          )}
          <button type="button" aria-pressed={labelsOn} onClick={() => setLabelsOn(!labelsOn)} title={ui('tipLabels')}>{ui('labels')}</button>
          <button type="button" onClick={toggleFullscreen} title={ui('tipFull')}>{full ? '⤡' : '⤢'}</button>
          {config.language.switcher && <a className="p-lang" href={otherLanguageHref()} title={ui('tipLanguage')}>{ui('otherLanguage')}</a>}
        </div>
      )}
    </>
  );
}
