/**
 * Closets, lockers and crates: the state both sides agree on. A closet's state is one number (`cs`); the server changes it
 * and tells everyone with a `cl` event, and each side applies it with `setClosetState` so collision matches.
 */
export const CL = { OPEN: 1, WELDED: 2, LOCKED: 4, BROKEN: 8 };

/** Which of the five sprites to show: closed, closed+locked, welded, welded+locked, open (see tools/closets.py). */
export function closetFrame(cs) {
  if (cs & CL.OPEN) return 4;
  return ((cs & CL.WELDED) ? 2 : 0) + ((cs & CL.LOCKED) ? 1 : 0);
}

/** A closed closet blocks the way; an open one does not, unless it is a crate (SS13's dense_when_open). */
export function closetSolid(cl, cs) {
  return !(cs & CL.OPEN) || cl.dopen;
}

/** Apply a state to a closet record (`it`, from buildPropData) and to the tile it stands on (a closed one is a locker-sized box standing on it). */
export function setClosetState(world, it, cs, gone = false) {
  it.cs = cs;
  it.gone = gone;
  it.dense = !gone && closetSolid(it.cl, cs);
  if (gone) world.boxDrop(it); else world.boxSet(it);
}

/** The sprite id for the closet's current state, or -1 if that look does not exist (it falls back to closed). */
export function closetSprite(it) {
  const fr = it.cl.fr;
  const s = fr[closetFrame(it.cs)];
  return s >= 0 ? s : fr[(it.cs & CL.OPEN) ? 4 : 0];
}
