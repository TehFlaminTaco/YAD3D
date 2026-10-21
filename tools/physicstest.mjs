// Smoke test for the grid physics layer (src/shared/physics.js over Rapier) and the transform maths (src/shared/math3.js): node tools/physicstest.mjs
import { initPhysics, PhysicsWorld } from '../src/shared/physics.js';
import {
  qYaw, qToYaw, qrot, qirot, qmul, qslerp, qFromAxisAngle, vlen, vsub, tfPoint, tfInvPoint, tfCompose, tfInverse, tfIntegrate, pointVelocity,
} from '../src/shared/math3.js';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const nearv = (a, b, e = 1e-6) => a.every((x, i) => near(x, b[i], e));

console.log('math3');
{
  // yaw 0 faces north (-z); a quarter turn to the left faces west (-x)
  ok(nearv(qrot(qYaw(0), [0, 0, -1]), [0, 0, -1]), 'yaw 0: forward stays north');
  ok(nearv(qrot(qYaw(Math.PI / 2), [0, 0, -1]), [-1, 0, 0]), 'a positive yaw turns forward toward -x (the game faces (-sin, -cos))');
  ok(near(qToYaw(qYaw(1.234)), 1.234), 'qToYaw inverts qYaw');
  const q = qmul(qYaw(0.7), qFromAxisAngle([1, 0, 0], 0.3));
  ok(nearv(qirot(q, qrot(q, [1, 2, 3])), [1, 2, 3]), 'qirot undoes qrot');
  const tf = { p: [10, 5, -3], q: qYaw(0.8) };
  ok(nearv(tfInvPoint(tf, tfPoint(tf, [1, 2, 3])), [1, 2, 3]), 'tfInvPoint undoes tfPoint');
  const inv = tfInverse(tf);
  ok(nearv(tfPoint(inv, tfPoint(tf, [4, 0, 1])), [4, 0, 1]), 'tfInverse maps back');
  const t2 = { p: [1, 0, 1], q: qYaw(-0.4) };
  ok(nearv(tfPoint(tfCompose(tf, t2), [2, 1, 0]), tfPoint(tf, tfPoint(t2, [2, 1, 0]))), 'tfCompose is b-local -> a-parent');
  const half = qslerp(qYaw(0), qYaw(1), 0.5);
  ok(near(qToYaw(half), 0.5, 1e-6), 'slerp halfway between yaws');
  // a body spinning about its centre at 1 rad/s: a point 2 m out moves at 2 m/s sideways
  ok(nearv(pointVelocity([0, 0, 0], [0, 1, 0], [0, 0, 0], [2, 0, 0]), [0, 0, -2]), 'point velocity of a spinning frame (w x r)');
  const moved = tfIntegrate({ p: [0, 0, 0], q: [0, 0, 0, 1] }, [1, 0, 0], [0, 2, 0], 0.5);
  ok(nearv(moved.p, [0.5, 0, 0]) && near(qToYaw(moved.q), 1, 1e-6), 'tfIntegrate moves and turns');
}

console.log('physics');
let t0 = performance.now();
await initPhysics();
console.log(`  started in ${(performance.now() - t0).toFixed(0)} ms`);

/** n x m floor tiles of 2 m, each a box, as one body's shape. */
const tiles = (n, m, d = 100) => {
  const out = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) out.push({ c: [c * 2 + 1, 0.5, r * 2 + 1], h: [1, 0.5, 1], d });
  return out;
};

{
  const w = new PhysicsWorld();
  w.addBody('a', { type: 'dynamic', p: [0, 0, 0] });
  w.setBoxes('a', tiles(20, 25));                                    // 500 boxes
  ok(w.mass('a') > 0, 'a compound body has mass');
  const com = w.centerOfMass('a');
  ok(near(com[0], 20, 0.01) && near(com[2], 25, 0.01), 'its centre of mass is the middle of the tiles');
  w.setVel('a', [1, 0, 0], [0, 0.5, 0]);
  t0 = performance.now();
  for (let k = 0; k < 200; k++) w.step(1 / 20);                      // ten seconds
  const per = (performance.now() - t0) / 200;
  const p = w.pose('a');
  ok(near(Math.hypot(...p.q), 1, 1e-4), 'the rotation stays a unit quaternion');
  ok(near(qToYaw(p.q), Math.atan2(Math.sin(5), Math.cos(5)), 0.02), 'spin about y at 0.5 rad/s for 10 s turns it 5 rad');
  ok(near(vlen(vsub(p.v, [1, 0, 0])), 0, 1e-3), 'no drag in space: velocity unchanged');
  console.log(`  500 boxes: ${per.toFixed(3)} ms per step`);
  ok(per < 5, '500 boxes step in under 5 ms');
  // a body spinning about its centre of mass drifts at the centre's speed, not the origin's
  w.free();
}

{
  // locks: only slides in the plane and a turn about y
  const w = new PhysicsWorld();
  w.addBody('a', { type: 'dynamic', p: [0, 0, 0], lock: { y: true, rx: true, rz: true } });
  w.setBoxes('a', tiles(4, 4));
  w.impulse('a', [3000, 5000, 1000], [0, 0.5, 8]);                   // pushes up, and off-centre (the middle is at 4, 0.5, 4)
  for (let k = 0; k < 40; k++) w.step(1 / 20);
  const p = w.pose('a');
  const up = qrot(p.q, [0, 1, 0]);
  ok(near(p.p[1], 0, 1e-4) && near(p.v[1], 0, 1e-4), 'a body locked to its plane never leaves it');
  ok(nearv(up, [0, 1, 0], 1e-4), 'and never tips over');
  ok(Math.hypot(p.p[0], p.p[2]) > 0.5 && Math.abs(qToYaw(p.q)) > 0.1, 'but it does slide and turn');
}

{
  // two grids meet: the moving one hits the resting one, momentum is shared, and the hit is reported
  const w = new PhysicsWorld();
  w.addBody('a', { type: 'dynamic', p: [0, 0, 0], v: [4, 0, 0] });
  w.addBody('b', { type: 'dynamic', p: [20, 0, 0] });
  w.setBoxes('a', tiles(3, 3)); w.setBoxes('b', tiles(3, 3));
  const m = w.mass('a');
  let hit = null;
  for (let k = 0; k < 200 && !hit; k++) { const ev = w.step(1 / 20); hit = ev.find((e) => (e.a === 'a' && e.b === 'b') || (e.a === 'b' && e.b === 'a')) || null; }
  ok(!!hit && hit.force > 0, 'a collision between two grids is reported with its force');
  for (let k = 0; k < 20; k++) w.step(1 / 20);
  const pa = w.pose('a'), pb = w.pose('b');
  ok(pb.v[0] > 0.5, 'the one that was at rest is set moving');
  ok(near((pa.v[0] + pb.v[0]) * m, 4 * m, m * 0.05), 'momentum is conserved');
}

{
  // a fixed station: a shuttle bounces off it and it does not move; a kinematic one is carried to where it is told
  const w = new PhysicsWorld();
  w.addBody('station', { type: 'fixed', p: [0, 0, 0] });
  w.setBoxes('station', tiles(5, 5));
  w.addBody('shuttle', { type: 'dynamic', p: [-30, 0, 5], v: [5, 0, 0] });
  w.setBoxes('shuttle', tiles(2, 2));
  for (let k = 0; k < 300; k++) w.step(1 / 20);
  ok(w.pose('station').p[0] === 0, 'a fixed body never moves');
  ok(w.pose('shuttle').p[0] < 0.5 && w.pose('shuttle').v[0] < 1, 'a shuttle flown into it is stopped (and bounced), not through it');
  w.addBody('dock', { type: 'kinematic', p: [100, 0, 0] });
  w.setBoxes('dock', tiles(2, 2));
  w.setPose('dock', [120, 0, 40], qYaw(1.0));
  w.step(1 / 20);
  ok(near(w.pose('dock').p[0], 120, 1e-3) && near(qToYaw(w.pose('dock').q), 1.0, 1e-3), 'a kinematic body is carried to the pose it is given');
  w.setType('dock', 'dynamic');
  ok(w.bodies.get('dock').type === 'dynamic', 'a body can change type (docked -> flying)');
  w.removeBody('dock');
  ok(!w.pose('dock'), 'a removed body is gone');
}

{
  // an engine: a steady force speeds a body up until it is changed
  const w = new PhysicsWorld();
  w.addBody('s', { type: 'dynamic', p: [0, 0, 0] });
  w.setBoxes('s', tiles(2, 2));
  const m = w.mass('s');
  w.thrust('s', [m * 2, 0, 0]);
  for (let k = 0; k < 20; k++) w.step(1 / 20);
  ok(near(w.pose('s').v[0], 2, 0.1), 'a force of 2 m/s^2 for one second gives 2 m/s');
  w.thrust('s', [0, 0, 0]);
  for (let k = 0; k < 20; k++) w.step(1 / 20);
  ok(near(w.pose('s').v[0], 2, 0.1), 'and it coasts when the engine stops');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
