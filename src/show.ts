// The two clocks that drive everything that moves.
// Kept outside React state on purpose: they change every frame and must not re-render the UI.
//   show: position inside the staged show (seconds; the show loops, see model/choreography.ts)
//   tour: time since the guided camera tour started (seconds)
export const clock = { show: 0, tour: 0 };
