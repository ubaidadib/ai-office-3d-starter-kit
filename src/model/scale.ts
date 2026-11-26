// Real-world scale. One grid cell = one world unit = 0.5 m.
export const CELL_M = 0.5;
/** Kenney Furniture Kit → world units. Gives a 1.40 × 0.75 m desk, 0.73 m high. */
export const FURNITURE_SCALE = 3.8;
/** Kenney Mini Characters → world units (same factor as the furniture, for consistency). */
export const CHARACTER_SCALE = 3.8;
export const unitsToMetres = (u: number) => u * CELL_M;
export const metresToUnits = (m: number) => m / CELL_M;
