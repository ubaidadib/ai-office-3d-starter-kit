import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './diagnostics';
import { OfficeScene } from './scene/OfficeScene';
import { Hud } from './ui/Hud';
import { PresentHud } from './ui/PresentHud';
import { LabelLayer } from './ui/LabelLayer';
import { useOffice } from './store';
import { probeOff } from './probe';
import { CLEAN, DEV, FRAME_ASPECT, PRESENT } from './mode';
import { applyDocumentSettings } from './i18n';
import './styles.css';
import './present.css';

applyDocumentSettings();
// Respect the macOS "Reduce motion" setting in developer mode: start with the staged movement paused.
// Presentation mode exists to show the staged movement, so it starts running.
if (DEV && window.matchMedia('(prefers-reduced-motion: reduce)').matches) useOffice.getState().setMovementPaused(true);

// An optional fixed-aspect capture frame (?frame=9x16 and so on), centred in the window.
const frameStyle = FRAME_ASPECT
  ? { width: `min(100vw, calc(100vh * ${FRAME_ASPECT}))`, height: `min(100vh, calc(100vw / ${FRAME_ASPECT}))` }
  : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className={'viewport' + (PRESENT ? ' present' : ' dev') + (CLEAN ? ' clean' : '')}>
      <div className="app" style={frameStyle}>
        <OfficeScene />
        {!probeOff('labels') && !probeOff('scene') && <LabelLayer />}
        {PRESENT ? <PresentHud /> : <Hud />}
      </div>
    </div>
  </StrictMode>,
);
