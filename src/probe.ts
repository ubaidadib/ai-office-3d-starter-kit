// Diagnostic switches for memory attribution (?probe=blank|shell|nolabels|nofurniture|nochar|noshadow|noaa|floor).
// They only remove parts of the scene; they never add or change data.
export const PROBE = new URLSearchParams(window.location.search).get('probe') ?? '';
export const probeOff = (part: 'scene' | 'labels' | 'furniture' | 'character' | 'shadow' | 'aa' | 'building'): boolean =>
  PROBE === 'blank' ? true
  : PROBE === 'floor' ? part !== 'scene'
  : PROBE === 'shell' ? part !== 'scene'
  : PROBE === 'no' + part;
