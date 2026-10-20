// Stacks and what they make, from stack.dm and sheet_types.dm (tgstation 2d6c10c1). Shared by the server (the rules) and the client (the menu's words).

/**
 * Item paths that stack, matched by prefix (longest first): `max` is max_amount, `one` the singular_name. Two items merge when they match the same
 * entry (merge_type), so `glass` and `glass/fifty` are one kind of thing.
 */
export const STACKS = [
  ['/obj/item/stack/sheet/plasmarglass', { max: 50, one: 'reinforced plasma glass sheet' }],
  ['/obj/item/stack/sheet/plasmaglass', { max: 50, one: 'plasma glass sheet' }],
  ['/obj/item/stack/sheet/rglass', { max: 50, one: 'reinforced glass sheet' }],
  ['/obj/item/stack/sheet/glass', { max: 50, one: 'glass sheet' }],
  ['/obj/item/stack/sheet/plasteel', { max: 50, one: 'plasteel sheet' }],
  ['/obj/item/stack/sheet/metal', { max: 50, one: 'metal sheet' }],
  ['/obj/item/stack/rods', { max: 50, one: 'metal rod' }],
  ['/obj/item/stack/tile/plasteel', { max: 60, one: 'floor tile' }],
];

/** The STACKS entry an item path belongs to (its merge_type), or null. */
export function stackKey(path) {
  if (!path) return null;
  for (const [k] of STACKS) if (path.startsWith(k)) return k;
  return null;
}

export function stackInfo(path) {
  const k = stackKey(path);
  return k ? STACKS.find(([p]) => p === k)[1] : null;
}

/** BYOND's `\s`: "1 metal sheet", "4 floor tiles". */
export const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * What the stack menu offers, per merge_type. `req` of the stack for `res` of `item` (a stack, up to `maxRes` at a time) or one `build` (a structure
 * put up in front of you; `onFloor`: only on a floor tile, `onePerTurf`: not where another stands), taking `time` ds. The DM lists a lot more (chairs,
 * frames, airlock assemblies...): they are for the structures the game cannot build yet.
 */
export const RECIPES = {
  '/obj/item/stack/sheet/metal': [
    { title: 'floor tile', req: 1, res: 4, maxRes: 20, item: '/obj/item/stack/tile/plasteel' },
    { title: 'metal rod', req: 1, res: 2, maxRes: 60, item: '/obj/item/stack/rods' },
    { title: 'wall girders', req: 2, time: 40, build: 'girder', onFloor: true, onePerTurf: true },
  ],
};

/**
 * The menu's rows for a stack of `amount`: each recipe with how many it can make (stack.dm ui_interact).
 * `mults` are the multipliers offered: 1, then 5, 10 and 25 where they fit, then the most there is room for.
 */
export function menuFor(key, amount, one) {
  return (RECIPES[key] || []).map((R, i) => {
    let maxMult = Math.floor(amount / R.req);
    const can = maxMult > 0;
    const res = R.res || 1;
    const mults = [];
    if (can) {
      mults.push(1);
      if ((R.maxRes || 1) > 1 && maxMult > 1) {
        maxMult = Math.min(maxMult, Math.round(R.maxRes / res));
        for (const n of [5, 10, 25]) if (maxMult >= n) mults.push(n);
        if (![5, 10, 25].includes(maxMult) && maxMult > 1) mults.push(maxMult);
      }
    }
    return { i, label: `${res > 1 ? `${res}x ${R.title}s` : R.title} (${plural(R.req, one)})`, res, can, mults };
  });
}
