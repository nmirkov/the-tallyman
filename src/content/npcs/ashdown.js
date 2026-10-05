// The Reverend Clement Ashdown, vicar of St Jude's (docs/STORY.md §2.4, §6.4). Never moves.

const ALIBI = { setFlag: 'alibi_known', note: 'alibi', say: '"Where did you - oh, God." He sits down heavily in a pew. "Yes. M. is Margaret Pollard. On the eighth, the night Ivy died, I was with her. All night. Ask her. Please don\'t ask anyone else."' };

const REGISTER = '"The Fourteen. We remember them every fifteenth of November - tonight, in fact. The families wanted the names kept in the burial register, not on the wall. It\'s on the desk in my vestry. Look, by all means."';
const ASYLUM = '"I was chaplain at Ashcombe until it closed. I may not speak about patients, Sergeant." A pause. "Even the ones who still live in the parish."';
const SILAS = '"Silas sees what he sees. I have never once known him lie."';

export const ashdown = {
  name: 'Reverend Ashdown', names: ['ashdown', 'vicar', 'reverend', 'priest', 'clement', 'rev', 'parson'], proper: true,
  location: 'st_judes',
  here: 'The Reverend Ashdown hovers by the candles, glancing at the crypt steps.',
  desc: 'Tall, stooped, sixty, a cardigan under his cassock. His hands will not keep still. He smells of candle smoke and Polo mints.',
  talk: '"Ah. Sergeant. Terrible business. Terrible. Can I - is there something?" He has put himself between you and the crypt steps.',
  shows: {
    love_letters: ALIBI,
    button: '"From a uniform, surely." He looks at you, then away, then at the door.',
    ledger_page: '"Pike, Mary." He reads it twice. "Oh, dear God. Oh, Arthur."',
    patient_file: '"I can\'t. I\'m sorry. I was chaplain there."',
    warrant_card: '"Yes, yes, of course."',
  },
  topics: {
    t_fire: REGISTER,
    t_mary: REGISTER,
    register: REGISTER,
    t_murders: '"I buried three of them. I\'ll bury Ivy on Monday. \'The Lord seeth not as man seeth.\' Or something very like it."',
    t_tally: '"Superstition. Though I confess I don\'t walk past the mill on a Thursday."',
    t_crypt: '"The crypt? Nothing down there. Damp. Coffins. Nothing at all." He licks his lips.',
    love_letters: [{ if: { carried: 'love_letters' }, then: ALIBI }, '"Letters? What letters?"'],
    t_alibi: [
      { if: 'alibi_known', say: '"I\'ve told you. I was with Margaret."' },
      '"The eighth? I was here. Praying. Alone. Quite alone."',
    ],
    maggie: '"Mrs Pollard is a pillar of the parish." Too quickly.',
    pike: '"Arthur? A sad boy, once. A good man now, I think. He tends the memorial, did you know? Every week. Polishes the plaques. Counts them, I sometimes think."',
    harrow: '"Your inspector sat with the register for an hour yesterday. Then he asked me about Arthur." He frowns. "I wondered why."',
    t_asylum: ASYLUM,
    patient_file: ASYLUM,
    silas: SILAS,
    t_counting: SILAS,
    t_keeper: SILAS,
    t_god: '"I pray, Sergeant. I am not always sure who listens."',
    t_ghost: '"There\'s no such thing." He crosses himself, which the Church of England does not encourage.',
    t_self: '"Thirty years in Blackmere. My wife is - at her sister\'s. In Harrogate."',
  },
  default: '"I really couldn\'t say, Sergeant."',
  refuse: '"Oh - no, no, thank you."',
  before: {
    attack: '"Sergeant!" He backs into the pews, hands up.',
  },
};
