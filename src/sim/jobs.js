// Player-selectable jobs: spawn landmark, ID access, starting kit (paths from the real item tree).
export const JOBS = [
  { id: 'assistant', title: 'Assistant', dept: 'general', blurb: 'No access, no plan, no one to blame but yourself. Maintenance is your friend.',
    items: ['/obj/item/flashlight'], worn: [] },
  { id: 'station_engineer', title: 'Station Engineer', dept: 'engineering', blurb: 'Tools, hard hat, yellow gloves and the know-how to restart the engine.',
    items: ['/obj/item/crowbar', '/obj/item/weldingtool', '/obj/item/wrench', '/obj/item/stack/sheet/metal', '/obj/item/flashlight'], worn: ['/obj/item/clothing/head/hardhat', '/obj/item/clothing/gloves/color/yellow'] },
  { id: 'atmospheric_technician', title: 'Atmospheric Technician', dept: 'engineering', blurb: 'You know exactly how fast a station can lose its air. Welder and sheets on hand.',
    items: ['/obj/item/weldingtool', '/obj/item/crowbar', '/obj/item/stack/sheet/metal', '/obj/item/extinguisher', '/obj/item/flashlight'], worn: [] },
  { id: 'medical_doctor', title: 'Medical Doctor', dept: 'medical', blurb: 'First aid, a health analyzer, and the patience of a saint.',
    items: ['/obj/item/storage/firstaid/regular', '/obj/item/healthanalyzer', '/obj/item/stack/medical/bruise_pack', '/obj/item/stack/medical/ointment', '/obj/item/flashlight'], worn: [] },
  { id: 'security_officer', title: 'Security Officer', dept: 'security', blurb: 'Baton and an energy gun. Windows are not a legitimate target. (They are, today.)',
    items: ['/obj/item/melee/baton', '/obj/item/gun/energy/e_gun/mini', '/obj/item/stock_parts/cell/high', '/obj/item/flashlight'], worn: [] },
  { id: 'scientist', title: 'Scientist', dept: 'science', blurb: 'A lab coat, a flashlight and a nagging feeling about the plasma lab.',
    items: ['/obj/item/flashlight', '/obj/item/multitool'], worn: [] },
  { id: 'cargo_technician', title: 'Cargo Technician', dept: 'cargo', blurb: 'Crates, crowbar, and a stack of sheet metal that nobody has counted.',
    items: ['/obj/item/crowbar', '/obj/item/stack/sheet/metal', '/obj/item/flashlight'], worn: [] },
  { id: 'captain', title: 'Captain', dept: 'command', blurb: 'All-access ID and an energy gun. Everyone is looking at you. That is the job.',
    items: ['/obj/item/gun/energy/e_gun', '/obj/item/stock_parts/cell/high', '/obj/item/flashlight'], worn: [], allAccess: true },
];

export function jobById(id) { return JOBS.find((j) => j.id === id) || JOBS[0]; }

export function accessFor(job) {
  const base = ['general', 'maintenance'];
  if (job.allAccess) return [...base, 'security', 'medical', 'engineering', 'science', 'cargo', 'service', 'command', 'external'];
  if (job.dept !== 'general') base.push(job.dept);
  if (job.dept === 'engineering') base.push('external');
  return base;
}

/** Fill the inventory with the job kit + a survival box (O2 tank + mask), as SS13 does. */
export function giveKit(game, job, name) {
  const { items, inv } = game;
  const id = items.fromPath('/obj/item/card/id');
  if (id) {
    id.name = `${name}'s ID card (${job.title})`;
    id.access = accessFor(job);
    inv.worn.id = id;
  }
  const add = (p, extra) => { const it = items.fromPath(p, extra); if (it) inv.add(it); return it; };
  for (const p of job.items) add(p, p.includes('sheet') ? { amount: 4 } : undefined);
  add('/obj/item/tank/internals/emergency_oxygen');
  add('/obj/item/clothing/mask/breath');
  for (const p of job.worn) {
    const it = items.fromPath(p);
    if (it && it.def.wear) inv.worn[it.def.wear] = it;
  }
  inv.sel = 0;
}
