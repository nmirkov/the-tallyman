// Content hooks (ARCHITECTURE A5; docs/STORY.md §7.6). The escape hatch for the few rules the
// Reaction / Cond data language cannot express: they all look at the *command* - which
// scenery entry the player named, or what a purchase is for (TT-131). Pure and
// deterministic (H1): they read `api` / `args` and change the game only through `api`.

const SCENERY_ID = /^([a-z][a-z0-9_]*)#(\d+)$/;

/** The room scenery entry a command's dobj names, or null (ids are `${roomId}#${index}`). */
function sceneryOf(api, id) {
  const m = typeof id === 'string' ? SCENERY_ID.exec(id) : null;
  if (!m) return null;
  const list = api.content.rooms[m[1]]?.scenery;
  return Array.isArray(list) ? list[Number(m[2])] ?? null : null;
}

/** Cond hook factory: the dobj is a scenery entry answering to `name`. */
const dobjScenery = (name) => (api, args) => {
  const sc = sceneryOf(api, args.cmd?.dobj);
  return !!sc && Array.isArray(sc.names) && sc.names.includes(name);
};

export const hooks = {
  /**
   * READ <scenery> (TT-131): signs, notices and plates are scenery, and the engine's READ only
   * reads items. Wherever a room has scenery, READ of it says what EXAMINE says (the writing
   * is in the desc). Returns false for anything else, so READ <item> runs as before (R4).
   */
  read_scenery(api, args) {
    const sc = sceneryOf(api, args.cmd?.dobj);
    if (!sc) return false;
    api.say(api.lit() ? sc.desc : "It's too dark to read.");
    return true;
  },

  /** BUY WHISKY FOR SILAS (TT-131): the purchase names who it is for. */
  for_silas: (api, args) => ['silas', 't_keeper', 't_counting'].includes(args.cmd?.topic),

  // ENTER / GO / OPEN <scenery> - which piece of scenery was meant (TT-131).
  dobj_towpath: dobjScenery('towpath'),
  dobj_church: dobjScenery('church door'),
  dobj_boot: dobjScenery('boot'),
  dobj_glovebox: dobjScenery('glovebox'),
  dobj_cupboard: dobjScenery('cupboard'),
  dobj_cottage: dobjScenery('cottage'),
  dobj_coalhole: dobjScenery('coal-hole'),
  /** GO IN / bare IN (TT-131). */
  dir_in: (api, args) => args.cmd?.dir === 'in',
  /** The morgue entered from the tunnel (up the rungs), not down the stair (TT-131). */
  from_tunnel: (api) => api.state.prevRoomId === 'tunnel',
};
