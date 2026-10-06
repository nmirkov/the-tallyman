// The Tallyman content bundle (ARCHITECTURE A4.2), assembled from the modules below.
// docs/STORY.md is the source of truth for every string and number in them.
//
//   rules.js       meta, rules (intro, money, nerve), zones, help        STORY §1, §3.1
//   registries.js  evidence, notes, vars, flag list, scoring / ranks     STORY §7.5, §11
//   shared.js      named shared reactions                                STORY §7.3
//   zones/*.js     rooms + their items and scenery, one file per zone    STORY §4, §5, §8.3-8.5
//   npcs/*.js      one file per NPC                                      STORY §2, §6
//   topics.js      ASK / TELL keywords                                   STORY §6.1
//   verbs.js       content verbs and synonyms                            STORY §7.4
//   case.js        ACCUSE and hazards                                    STORY §8.1, §8.6
//   endings.js     endings                                               STORY §8.7
//   beats.js       scripted beats and story daemons                      STORY §8.4, §9
//   hints.js       hint steps                                            STORY §10
//   art/index.js   pictures - owned by the artist tickets (TT-019...TT-021); static import
//                  so the single-file esbuild (iife) bundle needs no top-level await

import { meta, rules, zones, help } from './rules.js';
import { evidence, notes, vars, scoring } from './registries.js';
import { topics } from './topics.js';
import { verbs } from './verbs.js';
import { caseDef, hazards } from './case.js';
import { endings } from './endings.js';
import { beats, daemons } from './beats.js';
import { hints } from './hints.js';
import * as town from './zones/town.js';
import * as canal from './zones/canal.js';
import * as moor from './zones/moor.js';
import * as mill from './zones/mill.js';
import * as asylum from './zones/asylum.js';
import * as beneath from './zones/beneath.js';
import { maggie } from './npcs/maggie.js';
import { pike } from './npcs/pike.js';
import { ashdown } from './npcs/ashdown.js';
import { silas } from './npcs/silas.js';
import { harrow } from './npcs/harrow.js';
import { art } from './art/index.js';

/**
 * Item content order = STORY §5.1 table order (it drives room listings, A8.4, and the
 * item-before-NPC topic match, A4.9).
 */
export const ITEM_ORDER = Object.freeze([
  'warrant_card', 'wallet', 'torch', 'bench', 'coin', 'payphone', 'batteries', 'room_key', 'harrows_door', 'whisky',
  'pint', 'suitcase', 'case_map', 'harrows_notes', 'occurrence_book', 'candle_stub', 'button', 'dustbin', 'newspaper',
  'register', 'memorial', 'loose_stone', 'love_letters', 'lock_water', 'shed_door', 'bolt_cutters', 'oil_can',
  'handcuffs', 'notebook_page', 'crowbar', 'rope', 'exercise_book', 'mill_chain', 'ledger', 'ledger_page', 'iron_trap',
  'boiler_hatch', 'cabinet', 'patient_file', 'drawer_four', 'drawers', 'chains',
]);

const ZONE_MODULES = [town, canal, moor, mill, asylum, beneath];

/** Merges zone items into one table in ITEM_ORDER; throws on duplicates. */
function orderedItems() {
  const all = {};
  for (const table of ZONE_MODULES.map((z) => z.items)) {
    for (const [id, item] of Object.entries(table)) {
      if (Object.hasOwn(all, id)) throw new Error(`content: item "${id}" is defined twice`);
      all[id] = item;
    }
  }
  const unknown = Object.keys(all).filter((id) => !ITEM_ORDER.includes(id));
  if (unknown.length) throw new Error(`content: items missing from ITEM_ORDER: ${unknown.join(', ')}`);
  return Object.fromEntries(ITEM_ORDER.filter((id) => Object.hasOwn(all, id)).map((id) => [id, all[id]]));
}

/** @type {import('../engine/types.js').ContentBundle} */
export const content = {
  meta,
  rules,
  zones,
  rooms: Object.assign({}, ...ZONE_MODULES.map((z) => z.rooms)),
  items: orderedItems(),
  npcs: { maggie, pike, ashdown, silas, harrow },
  topics,
  vars,
  evidence,
  notes,
  scoring,
  hints,
  endings,
  beats,
  daemons,
  hazards,
  case: caseDef,
  verbs,
  help,
  art,
};

export default content;
