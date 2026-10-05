// Endings (docs/STORY.md §8.7). Array order = precedence of the `when` checks (A7.7):
// victory -> pyrrhic -> got-away -> fifth-stroke (catch-all, L19). Endings without `when`
// are reached by `end` effects (wrong man) and hazards / the attack counter (deaths).
// `art` ids are dropped in index.js while the art does not exist yet (lint L03).

const P = (...paragraphs) => paragraphs.join('\n\n');

const VICTORY = P(
  'You get Frank to his feet between you, his arm over your shoulders, and Pike walks ahead of you in the torchlight with his hands cuffed behind him, counting the bricks under his breath. Nobody else speaks. At the first turn of the tunnel Frank stops to cough, and when he can talk again he says, "You found the ledger, then." It isn\'t a question.',
  "By one in the morning Blackmere's blue lamp has six cars round it, Manchester and Lancashire both, and Maggie is making tea for men she has never met. Arthur Pike sits in his own cell and asks, very politely, for a pencil. They don't give him one. He scratches four strokes into the paint with his thumbnail, and stops, and sits looking at the place where the fifth should go.",
  'The mill comes down in December. Nobody in Blackmere goes out on a Thursday for a long time anyway.',
);

const PYRRHIC = P(
  "Midnight. Somewhere above you St Jude's strikes twelve, and the sound comes down through the brick like water.",
  'Pike, cuffed on his knees, lifts his head and listens to every stroke. When the twelfth has gone he smiles, and closes his eyes.',
  "Frank Harrow stopped breathing some time in the last quarter of an hour. You didn't see when. You were watching Pike. The chains still hold him up, his face turned a little to the wall, towards the four strokes and the space beneath them.",
  'You have your man. You will have a commendation, and your photograph in the Manchester Evening News, and every Thursday night for the rest of your life.',
  'Down in the dark, very quietly, Pike begins to count.',
);

const GOT_AWAY = P(
  "Midnight. St Jude's strikes twelve above you, and on the twelfth stroke Arthur Pike is simply not there any more. The scrape of the beam, the iron door, his boots in the tunnel - counting, going away - and then nothing but Frank's breathing and your own.",
  "You get Frank out. It takes an hour. When Manchester arrives you give them everything: the ledger, the register, the button, the boy who counted. They find Pike's bicycle at the asylum gates and his cape on the tally stone, folded, with four stones laid on it in a row.",
  'They search the moor for a week. Frank Harrow lives, and retires, and never goes back to Blackmere.',
  'But every year, on the fifteenth of November, someone cuts four fresh strokes into the tally stone. Never the fifth. Just the four, waiting.',
);

const FIFTH_OPENING = [
  "Midnight. St Jude's strikes twelve.",
  'Under the mill, in the Counting Room, Arthur Pike waits for the last stroke of the bell with his eyes shut, the way a choirboy waits for his note. Then he picks up the chisel.',
  'They find Frank Harrow on Friday morning, when the demolition men come to survey the mill. Beneath the four strokes on the brick there is a fifth, cut diagonally across them, closing the gate. The tally is settled.',
];

const FIFTH_STROKE = [
  {
    if: { awarded: 'accusation' },
    text: P(...FIFTH_OPENING, "Arthur Pike is never seen again. You told them who it was; you just didn't get there. And every November, on the fifteenth, someone polishes the fourteen brass plaques in St Jude's until they shine, and leaves a single chalk stroke on the vestry door."),
  },
  {
    text: P(...FIFTH_OPENING, 'PC Arthur Pike leads the search himself. He is very kind to you. He makes you tea, and calls you Sergeant, and tells Manchester you did all anyone could. On Saturday he waits on the platform until your train pulls out, and through the rain you watch him counting the carriages.'),
  },
];

const WRONG_MAN = [
  {
    if: 'accused_maggie',
    text: P(
      'You say it in front of the whole bar: "Margaret Pollard, I am arresting you..." The regulars put down their mild. Maggie looks at you for a long moment, then takes off her tea towel and folds it. "You\'ll want Arthur to take me in," she says. "He\'s very good with people."',
      'Arthur Pike takes her in, kindly, holding her elbow down the wet steps. He tells you to get some rest.',
      "At midnight, beneath the mill, he draws the fifth stroke. They find Frank Harrow on Friday. The vicar gives Maggie her alibi by Saturday dinner-time, at the cost of his marriage; the case against you takes rather longer to collapse. You never work CID again. Blackmere never forgets anything, and it never forgets you.",
    ),
  },
  {
    if: 'accused_ashdown',
    text: P(
      '"Clement Ashdown, I am arresting you..." The vicar does not argue. "The Lord is my shepherd," he says, quite calmly, as you caution him, and gets the second line wrong.',
      'PC Pike drives him down to the cells. "You\'ve done well, Sergeant," Pike says, and offers you a cup of tea, and you are so tired that you take it.',
      'At midnight, beneath the mill, Pike draws the fifth stroke. They find Frank Harrow on Friday. By Sunday Maggie Pollard has walked into the police house and given the vicar his alibi, in front of half the town. The Bishop moves him to a parish in Cumbria. They move you to traffic. Every November, on the fifteenth, somebody sends you a postcard with four strokes on it.',
    ),
  },
  {
    text: P(
      '"Silas Thorne, I am arresting you..." Silas laughs until he cries, and the whippet watches you with her ears flat. "Counting man\'ll be laughing too," he says. "Counting man\'ll be laughing all the way to the mill."',
      'PC Pike helps you get him into the car. He is very gentle with the old man. "Harmless," he tells you, "but you can\'t be too careful."',
      'At midnight, beneath the mill, Pike draws the fifth stroke. They find Frank Harrow on Friday. Silas is released on Saturday, after a night in the cells counting the bricks out loud, and on Sunday he is found in his lock, the paddles open. Accident, says the coroner. Blackmere nods. Blackmere has always known how to count.',
    ),
  },
];

const DEATH_DROWN = P(
  'You go into the lock. The cold stops your heart and then starts it again, which is worse. The water pouring through the paddles takes you down with it, down into the black, against the gates, and holds you there with all the patience of two hundred years. The last thing you hear is the lock filling. The last thing you think, absurdly, is that you are counting the seconds.',
  'Silas finds you in the morning when he opens the paddles. Frank Harrow they find on Friday, under the mill, beneath five strokes.',
);

const DEATH_FALL = P(
  'You lower yourself over the lip, feeling for holds. There aren\'t any. For a moment you hang by your fingers from the wet edge of Blackmere Quarry, the rain running into your sleeves, and you think, quite clearly: I was told. Then the rock lets go of you.',
  'Sixty feet is a long way and no time at all.',
  'Above, the old winch post leans out over the drop, where a rope could have been tied. At midnight, beneath the mill, Pike draws the fifth stroke, and the town says the quarry has taken another one.',
);

const DEATH_PIKE = [
  {
    if: { lit: true },
    text: P(
      '"Five," says Pike, close as a whisper, and the knife finds you. It doesn\'t hurt as much as you thought it would. You sit down against the brick, under the four great strokes, and watch him step over your legs to stand in front of Frank.',
      '"Sorry, Sergeant," he says. "You weren\'t in the ledger. But a tally\'s a tally."',
      'Your torch rolls away across the floor and comes to rest pointing at the wall, so that the last thing you see is the chisel in his hand, and the fifth stroke beginning.',
    ),
  },
  {
    text: P(
      'In the dark the counting comes from everywhere at once. "Two," says Pike, at your ear, and you never even see the knife.',
      "You sit down on the cold brick. Somewhere Frank is shouting your name, and then he isn't. Pike's voice goes on in the dark, gentle, patient, numbering things, until it is the only thing in the world.",
      'They find you both on Friday, under five strokes. You never did turn the light back on.',
    ),
  },
];

export const endings = [
  {
    id: 'victory', kind: 'victory', title: 'The Tally Settled', art: 'ending_victory', music: 'ending_good',
    when: [{ var: 'pikeState', eq: 'restrained' }, { var: 'harrowFreed', eq: true }], text: VICTORY,
  },
  {
    id: 'pyrrhic', kind: 'midnight', title: 'Paid in Full', art: 'ending_pyrrhic', music: 'ending_bad',
    when: [{ turnGte: 300 }, { var: 'pikeState', eq: 'restrained' }], text: PYRRHIC,
  },
  {
    id: 'got_away', kind: 'midnight', title: 'The One That Got Away', art: 'ending_got_away', music: 'ending_bad',
    when: [{ turnGte: 300 }, { var: 'harrowFreed', eq: true }], text: GOT_AWAY,
  },
  {
    id: 'fifth_stroke', kind: 'midnight', title: 'The Fifth Stroke', art: 'ending_fifth', music: 'ending_bad',
    when: { turnGte: 300 }, text: FIFTH_STROKE,
  },
  { id: 'wrong_man', kind: 'wrong', title: 'The Wrong Man', art: 'ending_wrong', music: 'ending_bad', text: WRONG_MAN },
  { id: 'death_drown', kind: 'death', title: 'Drowned', art: 'ending_death', music: 'ending_bad', text: DEATH_DROWN },
  { id: 'death_fall', kind: 'death', title: 'The Long Drop', art: 'ending_death', music: 'ending_bad', text: DEATH_FALL },
  { id: 'death_pike', kind: 'death', title: 'Counted', art: 'ending_death', music: 'ending_bad', text: DEATH_PIKE },
];
