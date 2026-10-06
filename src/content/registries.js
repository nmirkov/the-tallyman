// Registries (docs/STORY.md §7.5, §11): evidence, notes, typed story vars, the flag list
// and scoring / ranks. Complete for the whole game.

/** A4.10 — item evidence counts while carried; `ev_register` is a fact. */
export const evidence = {
  ev_ledger: { label: 'Ledger page (1912): the shed-door names, and "Pike, Mary, 14"', item: 'ledger_page', award: 'ledger_page' },
  ev_register: { label: 'Burial register: Mary Pike, 14, died in the fire', note: 'mary_pike', award: 'register' },
  ev_button: { label: 'Silver tunic button from No.13', item: 'button', award: 'button' },
  ev_file: { label: 'Patient file "A. PIKE", Ashcombe 1971-75', item: 'patient_file', award: 'file' },
};

/** Notebook entries, shown by NOTES in the order noted. */
export const notes = {
  hq_call: "HQ: Harrow's Cortina found abandoned on the moor road at 21:00. He asked Manchester for Ashcombe Asylum admissions, 1971 - never sent; he went to look himself.",
  case_map: "Harrow's map: the mill circled twice. Ashcombe Asylum, north of the tally stone, circled. At the lock: 'S. THORNE - saw something?'",
  harrow_list: "Harrow's notes: Ashworth, Crabtree, Holt, Marsh - all Thursdays, all old mill names. 'TALLY = DEBT. Who keeps the book?' And at the bottom: 'Harrow'.",
  pike_patrol: 'Occurrence book: PC Pike out on patrol, Moor Road, 20:35 to 21:20. Harrow radioed from the moor road at 20:40.',
  notebook: "Harrow's notebook page: 'Ledger at the mill names them. Ashcombe - 1970s files. The boy who counted.'",
  silas_story: 'Silas: a counting man in a police cape walks the towpath on Thursdays - into the mill, out at Ashcombe. An old tunnel runs from the asylum morgue to the Counting Room under the mill. The boiler-room hatch wants oil.',
  praying: 'Counting house: a man praying beneath the padlocked iron trap. Harrow is alive, under the mill.',
  morgue_drawer: "Patient file: 'the boy kept to the morgue - the drawer that does not close'.",
  alibi: 'Rev. Ashdown and Maggie Pollard were together all night on 8 November, when Ivy Marsh died.',
  mary_pike: 'Burial register: "Mary Pike, 14, d. 15 Nov 1912."',
};

/** A3.2 / A14.3 — exactly these vars, no extras. */
export const vars = {
  pikeState: { type: 'enum', values: ['desk', 'fled', 'left', 'counting', 'restrained'], init: 'desk' },
  pikeArrivalTurn: { type: 'int', nullable: true, min: 0, init: null },
  attack: { type: 'int', min: 0, init: 0 },
  harrowFreed: { type: 'bool', init: false },
};

/**
 * Every story flag (STORY §7.5; lint L22 checks each tested flag is set somewhere).
 * Documentation and a test oracle only - flags need no declaration in the bundle.
 */
export const FLAGS = Object.freeze([
  'maggie_saw_card', 'got_batteries', 'torch_loaded', 'heard_of_silas',
  'entered_harrows_room', 'phoned', 'alibi_known', 'letters_found', 'silas_told', 'shed_open', 'found_car',
  'climbed_down', 'torch_off_warned', 'dark_warned', 'mill_chain_cut', 'entered_mill', 'saw_girl', 'heard_praying', 'heard_harrow', 'hatch_oiled',
  'ward_counting', 'morgue_hatch_found', 'tunnel_music', 'pike_greeted', 'pike_fled', 'accused_maggie', 'accused_ashdown',
  'accused_silas',
]);

/** STORY §11: 13 awards summing to 100. */
export const scoring = {
  maxScore: 100,
  hintCost: 2,
  awards: {
    torch_lit: { points: 5, label: 'Lit the torch' },
    harrows_room: { points: 5, label: "Searched Harrow's room" },
    phone_call: { points: 5, label: 'Called HQ' },
    car_found: { points: 5, label: "Found Harrow's car" },
    silas_story: { points: 5, label: "Heard Silas's story" },
    mill_entered: { points: 5, label: 'Got into the mill' },
    ledger_page: { points: 10, label: 'Evidence: the ledger page' },
    register: { points: 10, label: "Evidence: Mary Pike's burial" },
    button: { points: 10, label: 'Evidence: the silver button' },
    file: { points: 10, label: 'Evidence: the patient file' },
    accusation: { points: 10, label: 'Named the Tallyman' },
    harrow_freed: { points: 10, label: 'Freed Frank Harrow' },
    arrest: { points: 10, label: 'Arrested Arthur Pike' },
  },
  ranks: [
    { min: 0, title: 'Probationer' },
    { min: 20, title: 'Constable' },
    { min: 40, title: 'Detective Constable' },
    { min: 60, title: 'Detective Sergeant' },
    { min: 80, title: 'Inspector' },
    { min: 100, title: 'Chief Inspector' },
  ],
};
