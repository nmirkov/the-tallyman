// ASK / TELL keyword table (docs/STORY.md §6.1; A4.9). Declaration order = match
// priority: specific before general. Items and NPCs are topics by their own names, so
// they are not repeated here.

export const topics = {
  t_mary: { names: ['mary', 'mary pike'] },
  t_counting_room: { names: ['counting room', 'vault', 'under the mill'] },
  // TT-131: before t_counting, so "last thursday" stays an alibi question.
  t_alibi: { names: ['alibi', 'the 8th', 'eighth', 'last thursday', 'whereabouts', 'where were you'] },
  t_counting: { names: ['counting man', 'counting', 'cape', 'man in a cape', 'thursday', 'thursdays'] },
  // Not in STORY §6.1: "lock keeper" would otherwise match the item `lock_water` (items
  // are matched before NPCs, A4.9 step 2) instead of Silas. STORY §7.2 step 8 requires
  // ASK MAGGIE ABOUT LOCK KEEPER to work; NPCs answer it exactly as they answer `silas`.
  t_keeper: { names: ['lock keeper', 'lock-keeper', 'keeper'] },
  t_tunnel: { names: ['tunnel', 'passage', 'morgue'] },
  // TT-131: ASK MAGGIE ABOUT ROOMS / HARROW'S ROOM (before the NPC name `harrow` is matched).
  t_room: { names: ['harrow room', 'his room', 'room', 'rooms', 'guest room', 'guest rooms', 'room three'] },
  t_door: { names: ['iron door', 'door', 'beam'] },
  t_patrol: { names: ['patrol', 'rounds', 'moor road', 'beat'] },
  t_murders: { names: ['murders', 'murder', 'killings', 'killing', 'victims', 'deaths', 'bodies', 'ashworth', 'crabtree', 'holt', 'marsh', 'ivy', 'edna', 'walter', 'dennis'] },
  t_tally: { names: ['tally', 'tallyman', 'tally man', 'tally marks', 'strokes', 'tallies', 'debt', 'debts', 'killer', 'murderer'] },
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
