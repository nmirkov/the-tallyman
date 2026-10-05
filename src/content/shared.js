// Shared reactions (docs/STORY.md §7.3), transcribed as named consts and referenced from
// every slot that uses them (STORY §0 "Shared reaction"). Pure data: no hooks (A5 H6).
// Item-local named reactions (HARROWS_DOOR, SHED, READ_REGISTER, MOVE_STONE, ...) live
// with their items in the zone files.

/** CALL HQ from the phone box: needs the 10p; once only (+5 `phone_call`). */
export const CALL_HQ = [
  { if: 'phoned', say: '"Look, Sarge, I\'ve told you everything we\'ve got." The line goes dead.' },
  {
    if: { carried: 'coin' }, sfx: 'phone',
    say: 'You feed in the 10p and dial. Pips. "Manchester CID, night desk." You give your name. "Sarge? Thank God. A farmer rang in at nine - Mr Harrow\'s Cortina, abandoned on the moor road, north of town. And he phoned us this afternoon asking for Ashcombe Asylum admissions, 1971. We never sent them. He said he\'d go up and look himself." Then the pips go, and the line.',
    setFlag: 'phoned', move: { coin: null }, note: 'hq_call', award: 'phone_call',
  },
  'You pat your pockets. No change. The phone wants 10p.',
];

/** PUT / USE / REPLACE BATTERIES: loads the torch (batteries leave the world). */
export const LOAD_TORCH = [
  { if: 'torch_loaded', say: 'The torch already has fresh batteries.' },
  {
    if: { any: [{ carried: 'torch' }, { present: 'torch' }] },
    say: 'You unscrew the torch, tip out the dead cells and thumb the fresh ones home. The spring bites. Ready.',
    setFlag: 'torch_loaded', move: { batteries: null },
  },
  "You'll need the torch to put them in.",
];

/** npcs.silas.accepts.whisky (the bottle is now Silas's: loc 'silas'). */
export const SILAS_STORY = {
  say: '"Ah." He has the cap off before you\'ve let go. A long pull. "Counting man. Thursdays. Big, in a cape like the bobbies wore. Counts my lock gates, goes in at the mill, comes out at Ashcombe an hour on with coal on him. There\'s a tunnel, see - asylum morgue to the Counting Room under the mill, where they made the wages up. There\'s a hatch in the boiler room an\' all, but it wants oil." He shuffles out into the rain; you hear the shed padlock fall. "Bolt cutters, oil can. Take \'em. The mill gates are chained."',
  setFlag: ['silas_told', 'shed_open'], note: 'silas_story', award: 'silas_story',
};

/** CUT the mill-gate chain (bolt cutters). */
export const CUT_CHAIN = [
  { if: 'mill_chain_cut', say: "It's cut already. The gates are open a body's width." },
  { if: { carried: 'bolt_cutters' }, sfx: 'chain', say: 'You set the jaws, lean on the handles, and the chain parts with a crack like a pistol. It slithers down the bars. The gates groan open a body\'s width.', setFlag: 'mill_chain_cut' },
  'With what - your teeth? You need bolt cutters.',
];

/** OIL the boiler hatch (oil can). */
export const OIL_HATCH = [
  { if: 'hatch_oiled', say: "It's had all the oil it needs. Try opening it." },
  { if: { carried: 'oil_can' }, say: 'You work the spout round the rim and wait. The rust drinks it. Somewhere in the hinge, something sighs.', setFlag: 'hatch_oiled' },
  "You've nothing to oil it with.",
];

/** CUT CHAINS / FREE HARROW (bolt cutters), regardless of Pike (A14.1 #10). */
export const CUT_CHAINS = [
  { if: { var: 'harrowFreed', eq: true }, say: 'Already cut.' },
  {
    if: { carried: 'bolt_cutters' }, sfx: 'chain', setVar: { harrowFreed: true }, award: 'harrow_freed',
    say: [
      { if: { var: 'pikeState', eq: 'restrained' }, text: 'You set the jaws on the first chain and lean. It parts. The second. Frank slides down the wall into your arms, light as a coat. "Took your time, kid," he says.' },
      { text: 'You get the jaws on the chain and lean - crack - and again - crack - and Frank drops onto his knees, gasping. "Behind you!" he says.' },
    ],
  },
  "They're padlocked to the rings. You'll need cutters.",
];

/** npcs.pike.before.arrest (A14.3, extended); also PUT / USE HANDCUFFS with Pike present. */
export const ARREST_PIKE = [
  { if: { var: 'pikeState', eq: 'restrained' }, say: 'He is going nowhere. He is counting the links of the cuffs.' },
  {
    if: [{ var: 'pikeState', eq: 'counting' }, { carried: 'handcuffs' }], sfx: 'chain', setVar: { pikeState: 'restrained' }, award: 'arrest',
    say: [
      { if: { var: 'harrowFreed', eq: true }, text: 'Frank throws himself at Pike\'s knees as you go for the knife arm. Pike is a big man, but a tired one; he has been counting all night. The knife rings on the brick. Click. Click. Pike sits back against the wall and goes very still.' },
      { text: 'He lunges. You sidestep, the knife skates across your coat, and you get one cuff on his wrist and wrench it round into the other. Click. Click. Pike goes down on his knees and stays there. "Four," he whispers. "Only four."' },
    ],
  },
  { if: { var: 'pikeState', eq: 'counting' }, say: "With what? Harrow croaks: 'Cuffs - in my car!'" },
  { if: { evidence: 3 }, say: '"On what charge, Sergeant?" he asks mildly. If you\'re sure, ACCUSE him.' },
  'Not yet. You need more than a hunch.',
];
