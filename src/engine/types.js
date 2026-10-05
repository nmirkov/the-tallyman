// The Tallyman — engine contract (TT-002).
// JSDoc typedefs for state, content schema, commands, events, hooks and saves,
// plus frozen constants. No behaviour lives here. docs/ARCHITECTURE.md is the prose
// specification; section references (A1…A17) point into it.

/* ======================================================================== *
 *  Frozen constants                                                         *
 * ======================================================================== */

/** @template T @param {T} o @returns {Readonly<T>} */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Game-seconds per turn (PLAN §2.3 Clock). */
export const TURN_SECONDS = 30;
/** Turn at which midnight strikes: 300 × 30 s = 2 h 30 min after START_TIME (PLAN §2.5). */
export const MIDNIGHT_TURN = 300;
/** Clock time at turn 0, 'HH:MM' (PLAN §2.3). */
export const START_TIME = '21:30';

/** State schema version; stored as `state.v` (A11). */
export const STATE_VERSION = 1;
/** Marker stored as `SaveData.format` (A11). */
export const SAVE_FORMAT = 'tallyman-save';
/** Valid save slots for SAVE n / LOAD n (PLAN §3.8). */
export const SAVE_SLOTS = deepFreeze([1, 2, 3]);

/** Reserved location meaning "carried by the player" (A3). */
export const PLAYER = 'player';

/** Canonical direction ids, in display order (A8.3). */
export const DIRECTIONS = deepFreeze(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'u', 'd', 'in', 'out']);
/** Display names for directions. */
export const DIRECTION_NAMES = deepFreeze({
  n: 'north', ne: 'northeast', e: 'east', se: 'southeast', s: 'south', sw: 'southwest',
  w: 'west', nw: 'northwest', u: 'up', d: 'down', in: 'in', out: 'out',
});
/** Opposite direction (used by the reciprocity lint rule). */
export const OPPOSITE = deepFreeze({
  n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e', nw: 'se', u: 'd', d: 'u', in: 'out', out: 'in',
});

/** Every Output Event type (A9). */
export const EVENT_TYPES = deepFreeze([
  'text', 'room', 'picture', 'status', 'sfx', 'ambient', 'music', 'pause', 'clear',
  'end', 'storage', 'host', 'prompt',
]);
/** Event types that, when present, are the LAST event of an input() call (A9.2). */
export const TERMINAL_EVENT_TYPES = deepFreeze(['prompt', 'end', 'storage']);
/** `host` ops that are terminal (chain barriers). `setting` is not terminal. */
export const TERMINAL_HOST_OPS = deepFreeze(['export', 'import', 'quit']);
/** Text styles (A9.1). The UI maps each to a theme role of the same name. */
export const TEXT_STYLES = deepFreeze(['normal', 'title', 'alert', 'whisper', 'echo', 'system']);
/** Pending question kinds stored in `state.ctx.pending` (A3.3). */
export const PENDING_KINDS = deepFreeze(['disambig', 'confirm']);

/** Verb classes and their default turn cost (A7.4). */
export const VERB_CLASSES = deepFreeze({ world: 1, meta: 0, system: 0 });
/** System verbs: free, and each ends a command chain (PLAN §3.4a chain barriers). */
export const CHAIN_BARRIERS = deepFreeze(['save', 'load', 'export', 'import', 'undo', 'restart', 'quit']);
/** Free (meta) verbs that are not barriers (A7.4). */
export const META_VERBS = deepFreeze([
  'score', 'notes', 'time', 'help', 'hint', 'inventory', 'verbose', 'brief', 'graphics',
  'sound', 'music', 'theme', 'typewriter',
]);
/** Verbs accepted once the game has ended (PLAN §3.4a full refresh). */
export const ENDED_VERBS = deepFreeze(['undo', 'load', 'restart', 'import']);
/** Pronoun words and the ctx field they read (A6.4). */
export const PRONOUNS = deepFreeze({ it: 'it', them: 'them', him: 'npc', her: 'npc' });

/** Ambient loop ids the audio layer must provide (PLAN §3.3, §3.7). */
export const AMBIENT_IDS = deepFreeze(['none', 'rain', 'wind', 'drone', 'pub', 'heartbeat', 'counting']);
/** Presentation settings owned by the host, with their accepted values (A10.3). */
export const HOST_SETTINGS = deepFreeze({
  sound: ['on', 'off', 'toggle'],
  music: ['on', 'off', 'toggle'],
  typewriter: ['on', 'off', 'toggle'],
  theme: ['c64', 'spectrum', 'amber', 'next'],
});
/** Ending kinds; the UI picks music / screen treatment by kind (A4.14). */
export const ENDING_KINDS = deepFreeze(['victory', 'midnight', 'wrong', 'death']);
/** Story-specific values of `vars.pikeState` (PLAN §2.5). Used by content and tests, never by engine code. */
export const PIKE_STATES = deepFreeze(['desk', 'fled', 'left', 'counting', 'restrained']);

/** Defaults for `content.rules` and `content.scoring` fields that content may omit (A4.2). */
export const RULE_DEFAULTS = deepFreeze({
  money: 0,
  hintCost: 2,
  nerve: { start: 0, dark: 5, lit: -1, safe: -5, max: 100, panicAt: 100, panicReset: 50, panicCooldown: 15 },
});

/** Size / length limits (A7.1, A13). */
export const LIMITS = deepFreeze({ inputLength: 200, chainLength: 16, roomDesc: 300, saveBytes: 262144 });

/** Art geometry, palette keys and effects (PLAN §3.5). */
export const ART_SIZES = deepFreeze({ location: { w: 40, h: 9 }, screen: { w: 40, h: 25 } });
export const PALETTE_KEYS = '0123456789abcdef';
export const ART_FX = deepFreeze(['rain', 'lightning', 'flicker', 'fog']);

/** Content id syntax (A4.1). Source of a RegExp; build with `new RegExp(ID_PATTERN)`. */
export const ID_PATTERN = '^[a-z][a-z0-9_]*$';

/** Keys a Condition object may have (A4.4). `var` combines with exactly one of VAR_OPS. */
export const COND_KEYS = deepFreeze([
  'all', 'any', 'not', 'flag', 'var', 'in', 'zone', 'carried', 'present', 'at', 'visited',
  'turnGte', 'turnLt', 'evidence', 'found', 'noted', 'awarded', 'lit', 'moneyGte', 'nerveGte',
  'open', 'locked', 'on', 'hook',
]);
export const VAR_OPS = deepFreeze(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'oneOf']);

/**
 * Keys of a Reaction object in their fixed application order (A4.5).
 * `if`/`else`/`chance` are evaluated first; `continue` is a flag, not an effect.
 */
export const REACTION_ORDER = deepFreeze([
  'sfx', 'pause', 'say', 'pick', 'setFlag', 'clearFlag', 'setVar', 'setItem', 'setNpc', 'reveal',
  'move', 'give', 'money', 'nerve', 'note', 'evidence', 'award', 'music', 'movePlayer', 'hook',
  'then', 'end',
]);
export const REACTION_CONTROL_KEYS = deepFreeze(['if', 'else', 'chance', 'style', 'continue']);

/** Text placeholders the engine interpolates in every Text (A4.3). */
export const TEXT_PLACEHOLDERS = deepFreeze(['money', 'time', 'turns', 'score', 'maxScore', 'nerve', 'evidence', 'rank']);

/**
 * Contract-level default messages (A16). Content may override any id via
 * `content.messages`. `{x}` placeholders are filled by the engine.
 */
export const MESSAGES = deepFreeze({
  empty: 'I beg your pardon?',
  unknownWord: 'I don\'t know the word "{word}".',
  noVerb: 'That\'s not a verb I recognise.',
  missingNoun: 'What do you want to {verbWord}?',
  noPattern: 'I didn\'t understand that sentence.',
  notHere: 'You can\'t see any such thing.',
  tooDark: 'It\'s too dark to see.',
  pronounUnset: 'I\'m not sure what \'{pronoun}\' refers to.',
  allNotAllowed: 'You can\'t use ALL with that verb.',
  allNothing: 'There\'s nothing to {verbWord}.',
  oneAtATime: 'You can only do that to one thing at a time.',
  disambig: 'Which do you mean, {list}?',
  againNothing: 'There\'s nothing to repeat.',
  chainIgnored: '(Commands after {VERB} were ignored.)',
  confirmCancelled: '(Cancelled.)',
  restartConfirm: 'Restart from the beginning? (Y/N)',
  quitConfirm: 'Really quit? (Y/N)',
  slotNeeded: 'Which slot? Type {VERB} 1, {VERB} 2 or {VERB} 3.',
  undone: '(Undone.)',
  cantUndo: 'You can\'t undo any further.',
  gameOver: 'The game is over. Type UNDO, LOAD, RESTART or IMPORT.',
  scoreUp: '[Your score has gone up by {n} points.]',
  noted: '(Noted in your notebook.)',
  dark: 'It is pitch dark. You can\'t see a thing, but you could feel your way back the way you came.',
  darkTitle: 'Darkness',
  darkMove: 'You blunder about in the dark but find no way through.',
  cantGo: 'You can\'t go that way.',
  canAlsoSee: 'You can see {list} here.',
  exits: 'Exits: {list}.',
  noExits: 'There is no obvious way out.',
  npcHere: '{The} is here.',
  taken: 'Taken.',
  dropped: 'Dropped.',
  fixed: 'That\'s fixed in place.',
  personal: 'You\'d sooner lose your head.',
  critical: 'You\'d better hang on to that.',
  stub: 'This part of Blackmere isn\'t built yet. You turn back.',
  cantDo: 'You can\'t do that.',
  engineError: '(Something went wrong: {error}. That command was cancelled.)',
});

/* ======================================================================== *
 *  Identifiers                                                              *
 * ======================================================================== */

/**
 * @typedef {string} RoomId     Content id of a room or stub (A4.1).
 * @typedef {string} ItemId     Content id of an item.
 * @typedef {string} NpcId      Content id of an NPC.
 * @typedef {RoomId|ItemId|NpcId} EntityId  Rooms, items, NPCs share one id namespace.
 * @typedef {string} SceneryId  `${roomId}#${index}` — derived id of a room scenery entry.
 * @typedef {string} HookId     Key in `content.hooks`.
 * @typedef {string} ArtId      Key in `content.art`.
 * @typedef {string} ZoneId     Key in `content.zones`.
 * @typedef {string} AwardId    Key in `content.scoring.awards`.
 * @typedef {string} NoteId     Key in `content.notes`.
 * @typedef {string} EvidenceId Key in `content.evidence`.
 * @typedef {string} EndingId   `id` of an entry in `content.endings`.
 * @typedef {string} HazardId   Key in `content.hazards`.
 * @typedef {string} TopicId    Key in `content.topics`, or an item/NPC id used as a topic.
 * @typedef {string} VerbId     Canonical verb id, e.g. 'take', 'go', 'accuse'.
 * @typedef {string} SfxId      Sound-effect id, e.g. 'door', 'thunder', 'sting', 'pickup'.
 * @typedef {'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'|'u'|'d'|'in'|'out'} Dir
 * @typedef {'in'|'on'|'with'|'from'|'to'|'at'|'about'|'under'|'behind'} PrepId
 * @typedef {RoomId|ItemId|NpcId|'player'|null} Loc  Item location; null = not in the world.
 * @typedef {'normal'|'title'|'alert'|'whisper'|'echo'|'system'} TextStyle
 */

/* ======================================================================== *
 *  State (A3) — plain JSON, round-trips through JSON.stringify/parse        *
 * ======================================================================== */

/**
 * @typedef {Object} ItemState
 * @property {Loc} loc            The ONLY record of where the item is. Inventory is derived.
 * @property {boolean} [open]     Present iff the item is `openable`.
 * @property {boolean} [locked]   Present iff the item is `openable`.
 * @property {boolean} [lit]      Present iff the item has `light`.
 * @property {number}  [fuel]     Present iff `light.fuel` is defined; remaining lit turns.
 * @property {boolean} [hidden]   Present iff the item is declared `hidden`; false once revealed.
 * @property {boolean} [worn]     Present iff the item is `wearable`.
 * @property {boolean} [moved]    Present iff the item has `initial` text; true once taken.
 */

/**
 * @typedef {Object} NpcState
 * @property {RoomId|null} loc    null = offstage.
 * @property {string|null} state  Free-form NPC state string for content; null by default.
 */

/**
 * @typedef {Object} ParsedNounPhrase  Syntax-level noun phrase (A6.2). Exactly one of
 *   words / pronoun / all / list is present.
 * @property {string[]} [words]        Significant words in order (articles dropped).
 * @property {'it'|'them'|'him'|'her'} [pronoun]
 * @property {true} [all]              ALL / EVERYTHING.
 * @property {ParsedNounPhrase[]} [except]  Only with `all`.
 * @property {ParsedNounPhrase[]} [list]    Coordinated phrases: KEY AND TORCH.
 */

/**
 * @typedef {Object} ParsedCommand  Output of parser.parseCommand (A6.2).
 * @property {VerbId} verb
 * @property {string} verbWord          The verb as typed, lower-case ('pick up', 'x').
 * @property {ParsedNounPhrase} [dobj]
 * @property {PrepId} [prep]
 * @property {ParsedNounPhrase} [iobj]
 * @property {Dir} [dir]                For movement verbs.
 * @property {string} [topic]           Free text after ABOUT (ASK/TELL); never unknown-word.
 * @property {string} [arg]             Single extra word/number: SAVE 2, SOUND OFF, THEME next.
 * @property {string} raw               The command text after normalisation.
 */

/**
 * @typedef {Object} ParseError
 * @property {'empty'|'unknown-word'|'no-verb'|'missing-noun'|'no-pattern'} error
 * @property {string} [word]            unknown-word / no-verb
 * @property {VerbId} [verb]            missing-noun / no-pattern
 * @property {string} [verbWord]
 * @property {string} raw
 */

/**
 * @typedef {Object} Command  Resolved command (A6.3) — what actions receive and what
 *   `ctx.lastCommand` / pending store. Plain JSON.
 * @property {VerbId} verb
 * @property {string} verbWord
 * @property {EntityId|SceneryId|Array<EntityId>} [dobj]  Array only for ALL / lists.
 * @property {PrepId} [prep]
 * @property {EntityId|SceneryId} [iobj]
 * @property {Dir} [dir]
 * @property {TopicId|null} [topic]     Matched topic id (null = no match).
 * @property {string} [topicText]
 * @property {string} [arg]
 * @property {boolean} [all]            dobj came from ALL (output gets per-object prefixes).
 * @property {true} [confirmed]         Set only when re-run after a YES answer. Never stored in lastCommand.
 * @property {string} raw
 */

/**
 * @typedef {Object} PendingDisambig
 * @property {'disambig'} kind
 * @property {string} text              Exact prompt text (re-emitted verbatim on refresh).
 * @property {ParsedCommand} command    The command being resolved.
 * @property {'dobj'|'iobj'} slot       Slot awaiting an answer.
 * @property {Array<EntityId|SceneryId>} candidates  In listing order.
 * @property {number} [index]           Element of a `list` phrase being asked about.
 * @property {Partial<Command>} bound   Slots already resolved (e.g. iobj when asking about dobj).
 */

/**
 * @typedef {Object} PendingConfirm
 * @property {'confirm'} kind
 * @property {string} text
 * @property {Command} command          Re-run with `confirmed: true` on YES.
 * @property {string} [cancelText]      Shown on NO / anything else; default MESSAGES.confirmCancelled.
 */

/** @typedef {PendingDisambig|PendingConfirm} Pending */

/**
 * @typedef {Object} Ctx  Parser context, persisted in saves (A3.3).
 * @property {EntityId|null} it          Last single object referred to.
 * @property {EntityId[]} them           Last multiple objects (ALL / lists).
 * @property {NpcId|null} npc            Last NPC referred to (HIM / HER).
 * @property {Command|null} lastCommand  For AGAIN.
 * @property {Pending|null} pending
 */

/**
 * @typedef {Object} Settings  Settings that change engine output (PLAN §3.4a host protocol).
 * @property {boolean} verbose   true: full description on every entry (default true).
 * @property {boolean} graphics  false: picture panel hidden (default true).
 */

/** @typedef {string|number|boolean|null} VarValue */

/**
 * @typedef {Object} TallymanVars  The story vars the Tallyman content declares (A3.2, PLAN §2.5).
 * @property {'desk'|'fled'|'left'|'counting'|'restrained'} pikeState
 * @property {number|null} pikeArrivalTurn  Turn Pike reaches the Counting Room when fled/left.
 * @property {number} attack                Attack counter, ≥ 0.
 * @property {boolean} harrowFreed
 */

/**
 * @typedef {Object} State  Complete game state (A3). Plain JSON; no functions, Maps, Sets,
 *   class instances, undefined values or non-finite numbers.
 * @property {1} v                       STATE_VERSION.
 * @property {number} seed               uint32 seed given to createGame.
 * @property {number} rng                uint32 mulberry32 state.
 * @property {number} turn               Turns elapsed, 0…MIDNIGHT_TURN.
 * @property {RoomId} roomId
 * @property {RoomId|null} prevRoomId    Room the player last left.
 * @property {RoomId[]} visited          Unique, in first-visit order (start room included).
 * @property {Record<ItemId, ItemState>} items  Exactly one entry per content item.
 * @property {Record<NpcId, NpcState>} npcs    Exactly one entry per content NPC.
 * @property {Record<string, boolean>} flags   Absent = false.
 * @property {Record<string, VarValue>} vars   Exactly the vars content declares.
 * @property {number} money              Pence, integer ≥ 0.
 * @property {number} score              0…maxScore.
 * @property {AwardId[]} awarded         Unique.
 * @property {Record<string, number>} hintTiers  Hint step id → next tier index.
 * @property {number} nerve              Integer 0…100.
 * @property {number} panicCooldown      Turns before panic may trigger again, ≥ 0.
 * @property {NoteId[]} notes            Unique, in order noted.
 * @property {EvidenceId[]} evidence     Unique, in order discovered (items and facts).
 * @property {HazardId[]} warned         Hazards whose single warning has been given.
 * @property {string[]} fired            Ids of once-only beats that have fired.
 * @property {Ctx} ctx
 * @property {Settings} settings
 * @property {EndingId|null} ended
 */

/* ======================================================================== *
 *  Content schema (A4)                                                      *
 * ======================================================================== */

/**
 * @typedef {string | Array<{if?: Cond, text: string}> | {hook: HookId}} Text
 *   Static string; or variants (first whose `if` holds; last should have no `if`);
 *   or a text hook returning a string. Placeholders: TEXT_PLACEHOLDERS.
 */

/**
 * @typedef {string | Cond[] | CondObject} Cond
 *   'flag' / '!flag' tests a flag; an array means ALL.
 */

/**
 * @typedef {Object} CondObject  Exactly one key from COND_KEYS (`var` + one VAR_OPS key).
 * @property {Cond[]} [all]
 * @property {Cond[]} [any]
 * @property {Cond} [not]
 * @property {string} [flag]
 * @property {string} [var]
 * @property {VarValue} [eq] @property {VarValue} [ne]
 * @property {number} [gt] @property {number} [gte] @property {number} [lt] @property {number} [lte]
 * @property {VarValue[]} [oneOf]        With `var`: membership.
 * @property {RoomId|RoomId[]} [in]      Player is in (one of) these rooms.
 * @property {ZoneId} [zone]
 * @property {ItemId} [carried]
 * @property {EntityId} [present]        Item visible to the player, or NPC in the player's room.
 * @property {[EntityId, Loc]} [at]      Item/NPC location equals.
 * @property {RoomId} [visited]
 * @property {number|{var: string}} [turnGte]  turn ≥ n (or ≥ the value of an int var; false if it is null).
 * @property {number|{var: string}} [turnLt]
 * @property {number} [evidence]         Evidence count ≥ n (A8.8).
 * @property {EvidenceId} [found] @property {NoteId} [noted] @property {AwardId} [awarded]
 * @property {boolean} [lit]             Player's location is lit === value.
 * @property {number} [moneyGte] @property {number} [nerveGte]
 * @property {ItemId} [open] @property {ItemId} [locked] @property {ItemId} [on]
 * @property {HookId} [hook]             Condition hook; must be pure.
 */

/**
 * @typedef {string | ReactionObject | Reaction[]} Reaction
 *   String = say it. Array = run the FIRST element whose `if` holds (cases).
 */

/**
 * @typedef {Object} ReactionObject  Effects applied in REACTION_ORDER (A4.5).
 * @property {Cond} [if]                 Guard; when false run `else` (if any) instead.
 * @property {Reaction} [else]
 * @property {number} [chance]           0…1, rolled on the state RNG after `if`.
 * @property {TextStyle} [style]         Style for `say`.
 * @property {boolean} [continue]        In a `before` slot: don't suppress the default action.
 * @property {SfxId} [sfx]
 * @property {number} [pause]            ms.
 * @property {Text} [say]
 * @property {Text[]} [pick]             Say one, chosen with the state RNG.
 * @property {string|string[]} [setFlag]
 * @property {string|string[]} [clearFlag]
 * @property {Record<string, VarValue|{add: number}|{turnPlus: number}>} [setVar]
 * @property {Record<ItemId, Partial<Omit<ItemState, 'loc'>>>} [setItem]
 * @property {Record<NpcId, {state: string|null}>} [setNpc]
 * @property {ItemId|ItemId[]} [reveal]
 * @property {Record<ItemId|NpcId, Loc>} [move]
 * @property {ItemId|ItemId[]} [give]    Move to the player.
 * @property {number} [money]            Pence delta (result clamped ≥ 0).
 * @property {number} [nerve]            Delta (clamped 0…100 immediately; caps/panic at daemon step).
 * @property {NoteId} [note]
 * @property {EvidenceId} [evidence]
 * @property {AwardId} [award]
 * @property {string} [music]
 * @property {RoomId} [movePlayer]
 * @property {HookId} [hook]             Runs last but `then`/`end`; returning false un-fires the reaction.
 * @property {Reaction} [then]           Evaluated after this object's effects (sees updated state).
 * @property {EndingId} [end]
 */

/**
 * @typedef {Object} Exit
 * @property {RoomId} to
 * @property {Cond} [if]                 Passable only while true.
 * @property {Text} [msg]                Shown when blocked (default MESSAGES.cantGo).
 * @property {ItemId} [door]             Passable only while that item is open.
 * @property {boolean} [hidden]          Not listed in the exits line while `if` is false.
 * @property {true} [oneWay]             Exempt from reciprocity; lint requires a hazard on it.
 */

/**
 * @typedef {Object} Scenery  Examine-only nouns of a room (not items).
 * @property {string[]} names
 * @property {string[]} [adjectives]
 * @property {Text} desc
 */

/**
 * @typedef {Object} Room
 * @property {string} name
 * @property {ZoneId} zone
 * @property {Text} desc                 ≤ 300 chars per variant.
 * @property {boolean} [dark]
 * @property {Partial<Record<Dir, RoomId|Exit>>} exits
 * @property {ArtId} [picture]
 * @property {string} [ambient]          AMBIENT_IDS; default zone ambient, then 'none'.
 * @property {Scenery[]} [scenery]
 * @property {Reaction} [onEnter]        After the description, on every entry.
 * @property {number} [nerve]            Extra nerve delta per turn ended here.
 * @property {Text} [sink]               If set, THROWn non-critical items are lost here (this text).
 * @property {Record<VerbId, Reaction>} [before]
 * @property {Record<VerbId, Reaction>} [after]
 */

/**
 * @typedef {Object} Zone
 * @property {string} name
 * @property {RoomId} [safeRoom]         Panic destination; required when panic is enabled.
 * @property {boolean} [panic]           Default true. false = Beneath.
 * @property {number} [nerveCap]         Max nerve in this zone (Beneath: 99).
 * @property {Text} [capText]            Said when nerve is clamped to the cap (crossing only).
 * @property {Text} [panicText]
 * @property {string} [ambient]
 */

/**
 * @typedef {Object} Item
 * @property {string} name               Display name without article ('brass key').
 * @property {string[]} names            Nouns (may be multiword: 'warrant card').
 * @property {string[]} [adjectives]
 * @property {string} [article]          'a' | 'an' | 'some' | 'the' | '' — default by first letter.
 * @property {Text} desc                 EXAMINE.
 * @property {Loc} location              Start location.
 * @property {Text} [initial]            Room-listing sentence until first taken.
 * @property {true|Text} [fixed]         Cannot be taken (Text = refusal).
 * @property {true} [scenery]            Not listed in rooms; implies fixed.
 * @property {RoomId[]} [alsoIn]         Fixed items (doors, gates) also present in these rooms.
 * @property {true} [critical]           PLAN §2.5 resource policy.
 * @property {Text} [criticalMsg]
 * @property {true} [personal]           Warrant card / wallet: never leaves the player.
 * @property {true} [hidden]             Starts hidden; revealed by SEARCH.
 * @property {Reaction} [found]          Said when revealed (default "You find {a item}.").
 * @property {boolean} [openable] @property {boolean} [open] @property {boolean} [locked]
 * @property {ItemId} [keyId]
 * @property {{capacity?: number, supporter?: boolean, transparent?: boolean}} [container]
 * @property {{lit?: boolean, fuel?: number, needs?: Cond, needsMsg?: Text, outText?: Text}} [light]
 * @property {boolean} [wearable]
 * @property {Reaction} [readable]       READ.
 * @property {Reaction} [edible] @property {Reaction} [drinkable]
 * @property {Record<VerbId, Reaction>} [before]
 * @property {Record<VerbId, Reaction>} [after]
 */

/**
 * @typedef {Object} ScheduleEntry
 * @property {number} at                 Turn (after the clock step).
 * @property {RoomId|null} to
 * @property {Cond} [if]
 * @property {Text} [leaveText]          Said if the player is in the room the NPC leaves.
 * @property {Text} [arriveText]         Said if the player is in the destination.
 * @property {Reaction} [do]
 */

/**
 * @typedef {Object} SellEntry
 * @property {number} price              Pence.
 * @property {Cond} [if]
 * @property {Text} [refuse]             When `if` is false.
 * @property {Text} [text]               On purchase.
 */

/**
 * @typedef {Object} Npc
 * @property {string} name
 * @property {string[]} names
 * @property {string[]} [adjectives]
 * @property {boolean} [proper]          Name takes no article ('Maggie').
 * @property {Text} desc
 * @property {Text} [here]               Room-listing sentence (default MESSAGES.npcHere).
 * @property {RoomId|null} location
 * @property {ScheduleEntry[]} [schedule]
 * @property {Record<TopicId, Reaction>} [topics]
 * @property {Reaction} [default]        ASK/TELL about an unmatched topic.
 * @property {Reaction} [talk]           TALK TO.
 * @property {Record<ItemId, Reaction>} [accepts]  GIVE: item moves to the NPC, then reaction.
 * @property {Record<ItemId, Reaction>} [shows]    SHOW.
 * @property {Reaction} [refuse]         GIVE of an item not in `accepts`.
 * @property {Record<ItemId, SellEntry>} [sells]
 * @property {Record<VerbId, Reaction>} [before]
 * @property {Record<VerbId, Reaction>} [after]
 */

/** @typedef {{names: string[]}} Topic  Keyword table for ASK/TELL topics. */

/**
 * @typedef {Object} Evidence
 * @property {string} label
 * @property {ItemId} [item]             Item evidence: counts while carried. Absent = fact.
 * @property {NoteId} [note]             Noted when discovered.
 * @property {AwardId} [award]           Awarded when discovered.
 */

/**
 * @typedef {Object} Scoring
 * @property {number} maxScore           Must equal the sum of award points.
 * @property {number} [hintCost]         Default RULE_DEFAULTS.hintCost.
 * @property {Record<AwardId, {points: number, label: string}>} awards
 * @property {Array<{min: number, title: string}>} ranks  Ascending; first min 0, last min maxScore.
 */

/** @typedef {{id: string, done: Cond, tiers: Text[]}} HintStep */

/**
 * @typedef {Object} Ending
 * @property {EndingId} id
 * @property {'victory'|'midnight'|'wrong'|'death'} kind
 * @property {string} title
 * @property {Text} text
 * @property {Cond} [when]               Checked at the endings step, in array order.
 * @property {ArtId} [art]               40×25 screen art.
 * @property {string} [music]
 */

/**
 * @typedef {Object} Beat  Scripted beat (daemon step 2).
 * @property {string} id
 * @property {number} [at]               Fires when turn === at.
 * @property {number} [every]            Fires when turn % every === 0.
 * @property {Cond} [when]
 * @property {boolean} [once]            Default true for `when`-only beats, else false.
 * @property {Reaction} run
 */

/** @typedef {{id: string, run: Reaction}} StoryDaemon  Daemon step 4, every turn, in order. */

/**
 * @typedef {Object} Hazard  Warned once, then fatal (PLAN §2.3 Deaths).
 * @property {RoomId} room
 * @property {Dir} [exit]                Triggered by moving this way.
 * @property {VerbId[]} [verbs]          Or by these verbs…
 * @property {EntityId[]} [objects]      …optionally only with these direct objects.
 * @property {Cond} [unless]             Safe when true (normal behaviour proceeds).
 * @property {Text} warn
 * @property {EndingId} ending
 */

/**
 * @typedef {Object} CaseDef  ACCUSE machinery (PLAN §2.5).
 * @property {NpcId} culprit
 * @property {number} threshold
 * @property {NpcId[]} suspects
 * @property {Text} confirm
 * @property {Reaction} correct
 * @property {Reaction} weak
 * @property {Reaction} wrong
 * @property {Text} [cancelText]
 * @property {Reaction} [other]
 */

/**
 * @typedef {Object} VarDecl
 * @property {'int'|'bool'|'str'|'enum'} type
 * @property {VarValue} init
 * @property {string[]} [values]         enum only.
 * @property {boolean} [nullable]
 * @property {number} [min] @property {number} [max]
 */

/**
 * @typedef {Object} VerbDef  Engine vocab entry or content extension (A6.1).
 * @property {VerbId} id
 * @property {string[]} [words]          Synonyms, may be multiword ('turn on').
 * @property {string[]} [patterns]       Grammar, e.g. 'put {dobj} in|into {iobj}'.
 * @property {'world'|'meta'|'system'} [class]
 * @property {Text} [default]            Content verbs: said when no reaction handles it.
 * @property {Text} [notHere]            Replaces MESSAGES.notHere for this verb.
 * @property {'carried'|'notCarried'|'worn'|'closed'|'open'|'unlit'|'lit'} [prefer]  Disambiguation preference (A6.3 M4).
 * @property {boolean} [multi]           Accepts ALL / lists (take, drop, put).
 */

/**
 * @typedef {Object} Art  PLAN §3.5.
 * @property {ArtId} id
 * @property {40} w
 * @property {9|25} h
 * @property {string[]} chars
 * @property {string[]} colors
 * @property {string[]|string} [bg]
 * @property {Array<'rain'|'lightning'|'flicker'|'fog'>} [fx]
 */

/** @typedef {{name: string, zone: ZoneId}} Stub */

/**
 * @typedef {Object} Rules
 * @property {RoomId} start
 * @property {Text} [intro]
 * @property {number} [money]
 * @property {Partial<typeof RULE_DEFAULTS.nerve> & {messages?: Array<{at: number, text: Text}>, panicText?: Text}} [nerve]
 * @property {ArtId} [darkPicture]
 */

/**
 * @typedef {Object} ContentBundle  Immutable at runtime (A4).
 * @property {{id: string, title: string, version: string}} meta
 * @property {Rules} rules
 * @property {Record<ZoneId, Zone>} zones
 * @property {Record<RoomId, Room>} rooms
 * @property {Record<ItemId, Item>} items
 * @property {Record<NpcId, Npc>} npcs
 * @property {Record<TopicId, Topic>} [topics]
 * @property {Record<string, VarDecl>} [vars]
 * @property {Record<EvidenceId, Evidence>} [evidence]
 * @property {Record<NoteId, Text>} [notes]
 * @property {Scoring} scoring
 * @property {HintStep[]} [hints]
 * @property {Ending[]} endings
 * @property {Beat[]} [beats]
 * @property {StoryDaemon[]} [daemons]
 * @property {Reaction[]} [afterAction]
 * @property {Record<HazardId, Hazard>} [hazards]
 * @property {CaseDef} [case]
 * @property {VerbDef[]} [verbs]
 * @property {Record<string, string>} [messages]
 * @property {Text} [help]
 * @property {Record<HookId, HookFn>} [hooks]
 * @property {Record<ArtId, Art>} [art]
 * @property {Record<RoomId, Stub>} [stubs]
 */

/* ======================================================================== *
 *  Hooks (A5)                                                               *
 * ======================================================================== */

/**
 * @typedef {Object} HookArgs
 * @property {string} phase              Slot name: 'before', 'after', 'cond', 'text', 'onEnter', 'daemon', …
 * @property {Command} [cmd]
 * @property {EntityId|null} [self]      Owner of the slot (item/NPC/room id).
 */

/**
 * @callback HookFn
 * @param {HookApi} api
 * @param {HookArgs} args
 * @returns {boolean|string|void}
 */

/**
 * @typedef {Object} HookApi  The only way hooks change the game (A5).
 * @property {Readonly<State>} state
 * @property {Readonly<ContentBundle>} content
 * @property {number} turn
 * @property {RoomId} room
 * @property {(cond: Cond) => boolean} test
 * @property {(name: string) => boolean} flag
 * @property {(name: string) => VarValue} var
 * @property {(id: ItemId) => boolean} carried
 * @property {(id: EntityId) => Loc} locOf
 * @property {(id: EntityId) => boolean} present
 * @property {() => boolean} lit
 * @property {() => number} evidenceCount
 * @property {{next: () => number, int: (n: number) => number, pick: <T>(arr: T[]) => T}} rng
 * @property {(text: Text, style?: TextStyle) => void} say
 * @property {(id: SfxId) => void} sfx
 * @property {(id: string) => void} music
 * @property {(ms: number) => void} pause
 * @property {(id: ItemId|NpcId, loc: Loc) => void} move
 * @property {(roomId: RoomId) => void} movePlayer
 * @property {(id: ItemId, patch: Partial<Omit<ItemState, 'loc'>>) => void} setItem
 * @property {(id: NpcId, patch: {state: string|null}) => void} setNpc
 * @property {(id: ItemId) => void} reveal
 * @property {(name: string, value?: boolean) => void} setFlag
 * @property {(name: string) => void} clearFlag
 * @property {(name: string, value: VarValue) => void} setVar
 * @property {(id: AwardId) => void} award
 * @property {(id: NoteId) => void} addNote
 * @property {(id: EvidenceId) => void} addEvidence
 * @property {(delta: number) => void} money
 * @property {(delta: number) => void} nerve
 * @property {(reaction: Reaction) => boolean} react
 * @property {(id: EndingId) => void} end
 */

/* ======================================================================== *
 *  Output Events (A9)                                                       *
 * ======================================================================== */

/**
 * @typedef {{type: 'text', text: string, style?: TextStyle}} TextEvent
 * @typedef {{type: 'room', id: RoomId, name: string}} RoomEvent
 * @typedef {{type: 'picture', id: ArtId|null, graphics: boolean}} PictureEvent
 * @typedef {{type: 'status', room: string, roomId: RoomId, time: string, score: number, maxScore: number, nerve: number, turns: number}} StatusEvent
 * @typedef {{type: 'sfx', id: SfxId}} SfxEvent
 * @typedef {{type: 'ambient', id: string}} AmbientEvent
 * @typedef {{type: 'music', id: string}} MusicEvent  id 'stop' stops music.
 * @typedef {{type: 'pause', ms: number}} PauseEvent
 * @typedef {{type: 'clear'}} ClearEvent
 * @typedef {{type: 'end', ending: EndingId, kind: string, title: string, text: string, score: number, maxScore: number, rank: string, turns: number, art: ArtId|null, music: string|null}} EndEvent
 * @typedef {{type: 'storage', op: 'save', slot: number, data: SaveData} | {type: 'storage', op: 'load', slot: number}} StorageEvent
 * @typedef {{type: 'host', op: 'export', data: SaveData} | {type: 'host', op: 'import'} | {type: 'host', op: 'quit'} | {type: 'host', op: 'setting', key: 'sound'|'music'|'theme'|'typewriter', value: string}} HostEvent
 * @typedef {{type: 'prompt', kind: 'disambig'|'confirm', text: string}} PromptEvent
 * @typedef {TextEvent|RoomEvent|PictureEvent|StatusEvent|SfxEvent|AmbientEvent|MusicEvent|PauseEvent|ClearEvent|EndEvent|StorageEvent|HostEvent|PromptEvent} OutputEvent
 */

/* ======================================================================== *
 *  Game API, saves, host (A2, A10, A11)                                     *
 * ======================================================================== */

/**
 * @typedef {Object} SaveData
 * @property {'tallyman-save'} format
 * @property {string} game               content.meta.id
 * @property {string} contentVersion     content.meta.version (informational)
 * @property {{room: string, time: string, score: number, turns: number}} summary  For slot lists; ignored on load.
 * @property {State} state
 */

/** @typedef {{ok: true, events: OutputEvent[]} | {ok: false, error: string, events: []}} LoadResult */

/**
 * @typedef {Object} GameOptions
 * @property {ContentBundle} content
 * @property {number} [seed]             uint32, default 1.
 * @property {boolean} [strict]          Tests: rethrow internal errors instead of rolling back.
 */

/**
 * @typedef {Object} Game
 * @property {() => OutputEvent[]} start
 * @property {(line: string) => OutputEvent[]} input
 * @property {(data: unknown) => LoadResult} load
 * @property {() => OutputEvent[]} undo
 * @property {() => OutputEvent[]} restart
 * @property {() => SaveData} save
 * @property {() => State} snapshot      Deep clone of the current state (tests/tools).
 */

/**
 * @typedef {Object} StorageAdapter  Host-side (A10.1). Never throws.
 * @property {boolean} persistent        false = in-memory fallback.
 * @property {(slot: number) => SaveData|null} read
 * @property {(slot: number, data: SaveData) => boolean} write
 * @property {() => Array<{slot: number, summary: SaveData['summary']|null}>} list
 * @property {(key: string) => string|null} readSetting
 * @property {(key: string, value: string) => boolean} writeSetting
 */

export {};
