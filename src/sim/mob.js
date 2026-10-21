import { Body } from '../shared/body.js';
import { SLOTS } from '../shared/config.js';

let mobSeq = 1;

/** Anything that walks around: player characters, NPC crew, carp, pets. */
export class Mob {
  constructor(sim, o) {
    this.id = mobSeq++;
    this.sim = sim;
    this.kind = o.kind;                      // 'human' | 'carp' | 'pet'
    this.name = o.name;
    this.job = o.job || null;                // job id for humans
    this.set = o.set;                        // sprite set key (carp, pets); people are composed from `look` instead
    this.look = o.look || null;              // a human's chosen appearance (see shared/looks.js)
    this.ap = null;                          // cached appearance: look + what they wear
    this.apDirty = true;
    this.grid = o.grid || null;              // the grid whose frame x, z are in; null = floating free in the void of `map` (then x, z are map coordinates)
    this.map = o.grid ? o.grid.map : o.map || null;
    this.x = o.x; this.y = o.y || 0; this.z = o.z;
    this.l = o.l | 0;                        // the deck of its grid it is on (grids have one deck, so far)
    this.fell = 0;                           // decks it fell this step (movement sets it, the sim handles the landing)
    this.landed = null;
    this.yaw = o.yaw ?? Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.vx = 0; this.vz = 0;
    this.vy = 0; this.q = [0, 0, 0, 1];      // floating in the void only: how fast it goes up, and the turn it keeps from the grid it left (its up); y is then the height of its middle
    this.speed = o.speed ?? 1.7;
    this.hostile = !!o.hostile;
    this.pet = !!o.pet;
    this.body = new Body({ max: o.hp ?? 100, breathes: o.breathes !== false, deathAt: o.deathAt ?? 40, regen: o.regen ?? 0.03 });
    this.body.onDeath = (cause) => sim.onMobDeath(this, cause);
    this.access = new Set(o.access || []);
    // SS13 inventory
    this.humanoid = o.kind === 'human';
    this.hands = [null, null];
    this.active = 0;
    this.worn = {};
    for (const s of SLOTS) this.worn[s] = null;
    this.cuffed = null;                      // the handcuffs on their wrists
    this.pulling = null;                     // who they are holding, and how tightly (0 passive, 1 aggressive, 2 neck)
    this.pulledBy = null;
    this.hauling = null;                     // an item or a structure they are dragging: {k: 'item' | 'prop', id | it, name}
    this.grab = 0;
    this.downed = false;                     // held by the neck: on the floor
    this.resistAt = 0;
    this.intent = 'help';
    this.throwMode = false;
    this.internals = false;
    this.lightOn = false;
    this.openContainers = new Set();         // ids of storage items the player has open in the UI
    // control
    this.client = null;                      // attached player, or null for AI
    this.input = { f: 0, b: 0, l: 0, r: 0, run: 0, yaw: this.yaw };
    this.busy = null;                        // timed action
    this.cool = 0;
    this.stunned = 0;
    this.fear = 0;
    this.dead = false;
    this.evacuated = false;
    this.speedNow = 0;
    this.anim = 0;
    // AI state
    this.home = [Math.floor(o.x / 2), Math.floor(o.z / 2)];
    this.path = null; this.pathIdx = 0; this.state = 'idle';
    this.timer = Math.random() * 4; this.talkCool = 10 + Math.random() * 40;
    this.repath = 0; this.stuck = 0;
  }

  get tile() { return [Math.floor(this.x / 2), Math.floor(this.z / 2)]; }
  get held() { return this.hands[this.active]; }
  get isPlayer() { return !!this.client; }
}
