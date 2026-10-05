// Art registry (ARCHITECTURE A4.16): every picture by id, merged from the per-zone files.
// Location pictures are 40x9, screen art (title, endings) 40x25. Room `picture` ids and
// ending `art` ids refer to these keys. Style rules for new pictures: tickets/TT-019.
import { townArt } from './town.js';
import { millArt } from './mill.js';
import { canalArt } from './canal.js';
import { moorArt } from './moor.js';
import { asylumArt } from './asylum.js';
import { beneathArt } from './beneath.js';
import { screensArt } from './screens.js';

const ZONE_ART = [townArt, canalArt, moorArt, millArt, asylumArt, beneathArt, screensArt];

/**
 * Merge per-zone art tables into one registry; a duplicate id is a content bug.
 * @param {Array<Record<string, import('../../engine/types.js').Art>>} tables
 * @returns {Record<string, import('../../engine/types.js').Art>}
 */
export function mergeArt(tables) {
  const all = {};
  for (const table of tables) {
    for (const [id, def] of Object.entries(table)) {
      if (Object.hasOwn(all, id)) throw new Error(`art: picture "${id}" is defined twice`);
      all[id] = def;
    }
  }
  return all;
}

/** @type {Record<string, import('../../engine/types.js').Art>} */
export const art = mergeArt(ZONE_ART);
export default art;
