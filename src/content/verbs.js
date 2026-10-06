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
  // Not in STORY §7.4 before TT-105: the winch post invites it ("You could tie a rope to that").
  // TIE ROPE (TO POST) at the quarry edge is the climb down (rope.before.tie, STORY §5.2).
  {
    id: 'tie', words: ['tie', 'fasten', 'knot', 'lash', 'attach'],
    patterns: ['<word> {dobj}', '<word> {dobj} to|on|onto|round|around {iobj}', '<word> up {dobj}', '<word> {dobj} up'],
    default: "You've nothing that needs tying.",
  },
  { id: 'pray', words: ['pray'], patterns: ['<word>'], default: 'You pray. The rain goes on.' },
  {
    id: 'knock', words: ['knock', 'bang', 'rap'], patterns: ['<word>', '<word> on {dobj}', '<word> at {dobj}'],
    default: 'Nobody answers.',
  },
  { id: 'open', patterns: ['open {dobj} with {iobj}'] }, // tool phrasing; content before.open decides
  { id: 'call', notHere: "You'll need a phone. There's a box in Market Square." },
  { id: 'free', words: ['unshackle'] },
  // TT-130: what a blind player types at the knife. Without the cuffs, ARREST_PIKE points at them.
  { id: 'arrest', words: ['subdue', 'tackle', 'apprehend', 'disarm', 'overpower', 'nick'] },
  // `cut {dobj} free`: not in STORY §7.4, but §7.2 step 29 lists CUT HARROW FREE.
  { id: 'cut', words: ['crop'], patterns: ['cut {dobj} free'] },
  // TT-131 (blind playtest): words a 1984 player tries that the game didn't know.
  // SAY / SHOUT / CALL OUT <anything>: rooms with someone to hear it answer (before.say).
  {
    id: 'say', words: ['say', 'shout', 'yell', 'call out', 'whisper', 'cry'], patterns: ['<word>', '<word> {topic}'],
    default: 'You say it out loud. The rain goes on as if you hadn\'t.',
  },
  {
    id: 'breathe', words: ['breathe'], patterns: ['<word>', '<word> deeply|slowly|deep|in|out'],
    default: 'In for four, out for four. You catch yourself counting, and stop.',
  },
  { id: 'drive', words: ['drive'], patterns: ['<word>', '<word> {dobj}', '<word> off|away'], default: 'You came on the train, and the last one has gone.' },
  { id: 'buy', patterns: ['<word> {dobj} for {topic}'] }, // BUY WHISKY FOR SILAS (whisky.before.buy)
  // GO / WALK TO <place>: ENTER it (ENTER X = IN, A8.3); rooms next to the towpath, the church
  // and the lock cottage take the player there by name (before.enter).
  { id: 'enter', patterns: ['go|walk|head|run to {dobj}', 'go|walk|head|run {dobj}'] },
  // Not in STORY §7.4: SEARCH HERE means a bare SEARCH (STORY §7.2 step 17). SEARCH ROOM /
  // SEARCH AROUND are engine patterns (A8.6), so "room" never binds to the room key.
  { id: 'search', patterns: ['search here'] },
];
