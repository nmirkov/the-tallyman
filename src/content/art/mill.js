// The Tallyman - location pictures, mill zone (art format: ARCHITECTURE A4.16, PLAN 3.5).
// Static PETSCII data: 40x9 cells; `chars`, `colors` (ink) and `bg` (paper) rows line up cell
// for cell; colour keys are C64 palette indices 0-f (src/ui/palette.js). Style rules: TT-019.

/** @type {Record<string, import('../../engine/types.js').Art>} */
export const millArt = {
  weaving_shed: {
    id: 'weaving_shed', w: 40, h: 9, fx: ['flicker'],
    chars: [
      '█▁▃▅▇█▁▃▅▇█▁▃▅▇█▁▃▅▇█▁▃▅▇█▁▃▅▇█▁▃▅▇█▁▃▅▇',
      '║║║║▌████████╎███████╎██████████╎██▐║║║║',
      '║║║║▌██▂▂▂▂▂▂╎███████╎████ ▂▂▂▂▂╎██▐║║║║',
      '║║║║▌██▆▆▆▆▆▆╎██▗▄▖██▗▄▖█▗▖▆▆▆▆▆▆██▐║║║║',
      '▂▂▂▂▌███║║║║║▌██▐║▌██▐║▌█▟▙║║║║║▏██▐▂▂▂▂',
      '████▌██▌▆▆▆▆▆▌█ ▝ ▘  ▝ ▘▗▓▓▖▆▆▆▆▐██▐████',
      '████▌██▌▂▁██▙█▆▃▄▅▅▅▅▅▅▄▄╵╵▟██▁▂▐██▐████',
      '▄▄▄▖▌██▘░██▗█▟▅▇ ▄▅▆▆▅▄▖▇▅▙█▅██░▝██▐▗▄▄▄',
      '▆▆▆ ▌██ ░▃▁▝▀▂▆▀▃▂▆▅▅▅▂▃▀▅▁▃▘▁▃░ ██▐ ▆▆▆',
    ],
    colors: [
      '06666066660eeee0666606666066660eee606666',
      '0000b00000000c0000000c0000000000c00b0000',
      '0000b00ccccccc0000000c00000cccccc00b0000',
      '0000b00b00000c00ccc00ccc0cc00000b00b0000',
      '0000b00b00000b00bbb00bbb0ff00000000b0000',
      '0000b00b00000b00b0b00b0bffff0000b00b0000',
      '0000b00b00bbbbbccccccccccccbbb00b00b0000',
      'bbbbb00bbbbcccfff7777777ffcccbbbb00bbbbb',
      '0000b000b00ccbcfccffffccfcbbc00b000b0000',
    ],
    bg: [
      '0000000000000000000000000000000000000000',
      'bbbb00000000000000000000000000000000bbbb',
      'bbbb00000000000000000000000000000000bbbb',
      'bbbb000cccccc00000000000000cccccc000bbbb',
      'bbbb000bbbbbb00000000000000bbbbbb000bbbb',
      '00000000bbbbb000000000000000bbbb00000000',
      '00000000bbbb0b0bbbbbbbbbb000bbbb00000000',
      '000000000bbbc0ccffffffffcc0cbbb000000000',
      'bbb000000bbbbcfcff7777ffcfccbbb000000bbb',
    ],
  },
};
