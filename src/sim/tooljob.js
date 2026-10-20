/**
 * One timed tool step, the way the DM's `I.use_tool(target, user, delay, ...)` does it: the player stands and works for `ds` deciseconds,
 * and it only happens if the target is still as it was, they still hold the tool and they are still close.
 *
 * `th` describes the target: `alive()`, `state()` (compared with `expect`, so a step cannot be finished twice or out of order),
 * `grid`, `x`, `z` (where it is) and `reach` (how far away you may stand).
 * `o`: `label` (the progress label), `ds`, `sfx` (the tool's sound), `start` (SS13's "You begin ..." line), `others` (what bystanders see),
 *      `valid()` (an extra check each tick, e.g. the welder is still lit) and `done()`.
 */
export function toolJob(sim, m, th, held, expect, o) {
  const near = () => sim.dist(m, th) < th.reach;
  if (o.others) sim.chat.visible(m, o.others, 'notice', 10, m);
  sim.actions.startTimed(m, o.label, o.ds / 10,
    () => th.alive() && th.state() === expect && m.held === held && near() && (!o.valid || o.valid()),
    o.done, o.sfx, { start: o.start });
}
