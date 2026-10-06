// DI Frank Harrow, your partner (docs/STORY.md §2.2, §6.6). Chained in the Counting Room
// from the start; never moves.

import { CUT_CHAINS } from '../shared.js';

export const harrow = {
  name: 'Harrow', names: ['harrow', 'frank', 'frank harrow', 'inspector', 'di', 'partner'], proper: true,
  location: 'counting_room',
  here: [
    { if: { var: 'harrowFreed', eq: true }, text: 'Frank Harrow sits against the wall, one hand pressed to his side.' },
    { text: 'DI Frank Harrow hangs in chains from the wall, his shirt dark at the side.' },
  ],
  desc: [
    { if: { var: 'harrowFreed', eq: true }, text: 'Frank, out of the chains, grey in the face, one hand pressed to his side. "Don\'t fuss," he says.' },
    { if: { turnGte: 240 }, text: 'Frank Harrow, chained by the wrists, grey as ash. The stain at his side has spread to his knees. His eyes are open. Just.' },
    { text: 'Frank Harrow, chained by the wrists to two iron rings, glasses gone, a dark stain spreading from his side. He sees you and nearly laughs. "Kid."' },
  ],
  talk: [
    { if: { var: 'pikeState', eq: 'counting' }, say: '"Don\'t talk to me - cuff him! Cuff him, kid!"' },
    { if: { var: 'harrowFreed', eq: false }, say: '"Kid. Cutters. Get me down."' },
    '"I\'m all right. I\'m not all right. Later."',
  ],
  before: {
    free: CUT_CHAINS,
    cut: CUT_CHAINS,
    attack: 'He\'s on your side. Mostly.',
  },
  topics: {
    pike: '"The ledger names us, kid. My grandad held the key. He\'s been settling it one Thursday at a time."',
    handcuffs: [{ if: { carried: 'handcuffs' }, say: '"Then use them!"' }, '"Cuffs - in my car! Moor road!"'],
    t_door: '"He always leaves himself a way out. Lifted the bar when he came down. Counts his exits, this one."',
    t_tunnel: '"He always leaves himself a way out. Lifted the bar when he came down. Counts his exits, this one."',
    t_self: '"Bleeding. Don\'t make a thing of it."',
    bolt_cutters: [{ if: { var: 'harrowFreed', eq: true }, say: '"Done. Now him."' }, '"Cut me down, then!"'],
    chains: [{ if: { var: 'harrowFreed', eq: true }, say: '"Done. Now him."' }, '"Cut me down, then!"'],
  },
  default: '"Later, kid. Later."',
  refuse: '"Not now, kid."',
};
