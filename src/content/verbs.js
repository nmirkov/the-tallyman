// Content verbs and synonym additions (docs/STORY.md §7.4; A4.15, A6.1).
//
// Deviation from STORY §7.4, mechanical only: patterns start with `<word>` (any of the
// verb's words) where STORY wrote the first word literally ('pry {dobj}'), so that the
// listed synonyms (PRISE, LEVER, FORCE, CHANGE, SQUIRT, ...) actually parse.

export const verbs = [
  {
    id: 'pry', words: ['pry', 'prise', 'prize', 'lever', 'force'],
    patterns: ['<word> {dobj}', '<word> {dobj} open', '<word> open {dobj}', '<word> {dobj} with {iobj}', '<word> open {dobj} with {iobj}', '<word> {dobj} open with {iobj}'],
    default: "You can't get any purchase on that.",
  },
  {
    id: 'replace', words: ['replace', 'change', 'swap', 'fit'], patterns: ['<word> {dobj}', '<word> {dobj} in {iobj}'],
    default: 'Replace it with what?',
  },
  {
    id: 'pour', words: ['pour', 'squirt', 'drip'], patterns: ['<word> {dobj}', '<word> {dobj} on|onto|over|into|in {iobj}'],
    default: "You'd only waste it.",
  },
  { id: 'pray', words: ['pray'], patterns: ['<word>'], default: 'You pray. The rain goes on.' },
  {
    id: 'knock', words: ['knock', 'bang', 'rap'], patterns: ['<word>', '<word> on {dobj}', '<word> at {dobj}'],
    default: 'Nobody answers.',
  },
  { id: 'open', patterns: ['open {dobj} with {iobj}'] }, // tool phrasing; content before.open decides
  { id: 'call', notHere: "You'll need a phone. There's a box in Market Square." },
  { id: 'free', words: ['unshackle'] },
  // `cut {dobj} free`: not in STORY §7.4, but §7.2 step 29 lists CUT HARROW FREE.
  { id: 'cut', words: ['crop'], patterns: ['cut {dobj} free'] },
  // Not in STORY §7.4: SEARCH ROOM / SEARCH HERE mean a bare SEARCH (STORY §7.2 step 17).
  // Without this, "room" binds to the room key (its name) instead of the room.
  { id: 'search', patterns: ['search room|here'] },
];
