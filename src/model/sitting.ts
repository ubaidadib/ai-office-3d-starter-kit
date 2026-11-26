// Pure sitting maths (unit-tested): where to put the figure's root so that its
// seat-contact point (thigh underside centre, measured in the sit pose) lands on the
// chair's seat centre, facing the desk.
export interface SeatLike { x: number; z: number; face: number }
export interface ChairSeat { y: number; forward: number }
export interface Contact { x: number; y: number; z: number }

/** World position of the seat centre for a chair at (x, z) facing `face`. */
export function seatCentre(seat: SeatLike, chair: ChairSeat): { x: number; y: number; z: number } {
  return { x: seat.x + Math.sin(seat.face) * chair.forward, y: chair.y, z: seat.z + Math.cos(seat.face) * chair.forward };
}

/** Rotate a figure-local offset by the figure's facing (three.js Y-rotation convention). */
export function rotateLocal(x: number, z: number, face: number): { x: number; z: number } {
  return { x: x * Math.cos(face) + z * Math.sin(face), z: -x * Math.sin(face) + z * Math.cos(face) };
}

/** Root position that places `contact` (figure-local) exactly on the seat centre. */
export function seatedRootPosition(seat: SeatLike, chair: ChairSeat, contact: Contact): { x: number; y: number; z: number } {
  const c = seatCentre(seat, chair);
  const o = rotateLocal(contact.x, contact.z, seat.face);
  return { x: c.x - o.x, y: c.y - contact.y, z: c.z - o.z };
}
