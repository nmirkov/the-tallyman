// ASK / TELL keyword table (docs/STORY.md §6.1; A4.9). Declaration order = match
// priority: specific before general. Items and NPCs are topics by their own names, so
// they are not repeated here.

export const topics = {
  t_mary: { names: ['mary', 'mary pike'] },
  t_counting_room: { names: ['counting room', 'vault', 'under the mill'] },
  t_counting: { names: ['counting man', 'counting', 'cape', 'man in a cape'] },
  // Not in STORY §6.1: "lock keeper" would otherwise match the item `lock_water` (items
  // are matched before NPCs, A4.9 step 2) instead of Silas. STORY §7.2 step 8 requires
  // ASK MAGGIE ABOUT LOCK KEEPER to work; NPCs answer it exactly as they answer `silas`.
  t_keeper: { names: ['lock keeper', 'lock-keeper', 'keeper'] },
  t_tunnel: { names: ['tunnel', 'passage', 'morgue'] },
  t_door: { names: ['iron door', 'door', 'beam'] },
  t_patrol: { names: ['patrol', 'rounds', 'moor road', 'beat'] },
  t_alibi: { names: ['alibi', 'the 8th', 'eighth', 'last thursday', 'whereabouts', 'where were you'] },
  t_murders: { names: ['murders', 'murder', 'killings', 'killing', 'victims', 'deaths', 'bodies', 'ashworth', 'crabtree', 'holt', 'marsh', 'ivy', 'edna', 'walter', 'dennis'] },
  t_tally: { names: ['tally', 'tallyman', 'tally marks', 'strokes', 'tallies', 'debt', 'debts'] },
  t_fire: { names: ['fire', '1912', 'fourteen', 'mill girls', 'girls', 'blaze'] },
  t_mill: { names: ['mill', 'ashworths', 'counting house', 'demolition'] },
  t_asylum: { names: ['asylum', 'ashcombe', 'hospital', 'loony bin', 'madhouse'] },
  t_crypt: { names: ['crypt', 'cellar', 'downstairs'] },
  t_change: { names: ['change', 'ten pence', 'phone', 'coin', '10p'] },
  t_drink: { names: ['drink', 'pint', 'mild', 'beer', 'bitter'] },
  t_light: { names: ['light', 'dark', 'batteries', 'battery'] },
  t_ghost: { names: ['ghost', 'mill girl', 'apparition', 'spirit'] },
  t_god: { names: ['god', 'prayer', 'faith', 'church', 'jude'] },
  t_quarry: { names: ['quarry', 'quarry hut', 'tools'] },
  t_self: { names: ['yourself', 'himself', 'herself', 'you'] },
};
