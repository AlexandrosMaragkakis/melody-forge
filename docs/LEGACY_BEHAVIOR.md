# Legacy behavior

This document records the behavior found by reading every file in `legacy/` as
plain text. The programs were not imported or executed. Line references below
refer to the preserved files as they existed when the SHA-256 baseline in
`LEGACY_SHA256.txt` was recorded.

## Preservation baseline

| File | SHA-256 |
| --- | --- |
| `legacy/notes_generator1.py` | `203c91aa48d2df05f33b3a0910d0c69c68bf16ef194913cb7b52acb94e0c6029` |
| `legacy/tmp.py` | `d0d288968392db0f7ad53fb78a8c0ca00567449c7aab01cd8bb032f42789bff2` |

The final verification must compare the complete sorted manifest, not merely
these two remembered paths, so additions and removals are detected too.

## Actual simple-melody behavior

- The note-name and sounding-pitch tables are the twelve sharp-spelled pitch
  classes `C` through `B`, mapped directly to MIDI 60 through 71
  (`notes_generator1.py:33-37`). There is no octave parameter or enharmonic
  spelling.
- Scale definitions are seven cyclic step sizes. `pool` walks the first seven
  degrees from the selected tonic and manually wraps pitch-class indexes at
  12, 13, and 14 (`notes_generator1.py:102-190`). The resulting pool contains
  seven pitch classes, each in the fixed C4-B4 MIDI band. Consequently, a
  non-C scale can wrap *downward* in pitch: for example D Ionian is sounded as
  D4 E4 F#4 G4 A4 B4 C#4.
- `random_melody` makes exactly `num` independent calls to an inclusive uniform
  integer chooser over indexes 0-6, then overwrites the last and first values
  with the tonic (`notes_generator1.py:192-202`). Internal notes are therefore
  independent and uniform scale-degree choices; endpoints are always tonic.
- Interactive note counts are restricted to 4-32 inclusive. The `random`
  note-count choice uses the same inclusive range (`notes_generator1.py:424-439`).
  The separate completely-random path currently fixes the count to eight even
  though an older random expression remains in a comment
  (`notes_generator1.py:457-497`).
- The melody has no rests, articulation, velocity variation, per-note editing,
  or rhythmic variation. Saved Sonic Pi text sleeps `0.2` after every note, so
  all inter-onset durations are equal (`notes_generator1.py:204-227`).
- The generator returns note names only. Playback is not performed by the main
  Python program; it optionally writes a Sonic Pi source fragment.

## Scale inventory and aliases

The source contains three presented families:

- The seven diatonic modes: Ionian, Dorian, Phrygian, Lydian, Mixolydian,
  Aeolian, and Locrian (`notes_generator1.py:39-51`).
- Seven harmonic-minor rotations: Harmonic Minor, Locrian #6, Ionian #5,
  Dorian #4, Phrygian Dominant, Lydian #2, and a seventh mode labelled
  `super locrian` (`notes_generator1.py:53-65`). Its intervals are the
  harmonic-minor seventh mode commonly called Ultra Locrian; the legacy label
  is retained as a family-scoped alias so it is not confused with the melodic
  minor seventh mode.
- Seven ascending melodic-minor rotations: Melodic Minor, Dorian b2, Lydian
  Augmented, Lydian Dominant, Mixolydian b6, Aeolian b5, and Altered Scale
  (`notes_generator1.py:67-79`). Altered Scale is also commonly called Super
  Locrian.

The source additionally presents a “natural minor” family, but it is the same
seven diatonic definitions reordered from Aeolian (`notes_generator1.py:81-84`).
The new catalogue stores one canonical definition per pitch-class pattern and
represents this historical grouping with aliases/metadata rather than duplicate
interval data.

The legacy source has TODO comments for pentatonic, blues, and exotic scales;
it did not implement them (`notes_generator1.py:7-26`). Those required by the
new product are additions, not claimed legacy behavior.

## Historical quirks intentionally retained in Legacy mode

- Four to thirty-two events.
- Uniform, independent selection from every scale degree for every initial
  draw, followed by tonic replacement at both boundaries.
- Equal positive durations and no rests.
- The fixed C4-B4 pitch-class-to-MIDI table, including downward wrapping in
  non-C scales.
- Sharp pitch-class names in historical descriptions, while UI spelling is a
  separate presentation concern.

## Intentional differences in the browser implementation

- A documented deterministic seeded PRNG replaces Python's process-global
  `random` state. Python's random sequence is not reproduced; the application
  seed, complete settings, and generator version define reproducibility.
- Equal durations are represented as one integer beat (480 ticks) and tempo is
  an explicit playback setting. This retains rhythmic equality without
  depending on Sonic Pi's `sleep 0.2` convention.
- Repetition is a live playback Loop switch. It is not serialized as four
  copies of the melody.
- Scale choices come from the verified shared catalogue. Legacy family names
  are aliases/groupings around canonical definitions.
- Playback uses an in-browser synthesizer initialized by a user gesture. No
  source file is generated merely to hear a melody.

## Bugs and non-domain implementation details not retained

- The original wrap logic special-cases only totals 12-14, relies on seven-note
  modes, and mixes pitch-class indexes with names. The new conversion is
  generic modulo arithmetic over declarative scale offsets.
- Selection relies on substring tests such as `'major' in path` and partial
  mode-name matching. The new application uses stable scale IDs.
- The original script executes an interactive terminal loop at import time
  (`notes_generator1.py:509-592`). The historical file remains untouched, but
  the new application does not import it.
- Input clearing, terminal output, text-file prompts, and Python-specific RNG
  call order are presentation or implementation details rather than musical
  semantics.

## Explicitly excluded historical branches

- The chord-progression path is incomplete. It generates only for major triads;
  minor, dominant seventh, major seventh, and minor seventh branches are
  `pass`. Sharp chord roots are also truncated to their first character
  (`notes_generator1.py:538-592`). No chord branch, harmony, or accompaniment
  is included in the new product.
- The optional saved Sonic Pi fragment wraps output in `4.times`, adds a fixed
  bass-drum hit plus random drum hits, and uses a fixed `sleep 0.2`
  (`notes_generator1.py:204-227`). Repetition becomes a playback option; drums
  and generated Sonic Pi code are excluded.
- `legacy/tmp.py` is a separate OSC/Sonic Pi experiment that sends MIDI 60 to a
  local server. External OSC, Sonic Pi, and real-time accompaniment are excluded.
- Commented ideas for bends, vibrato, tapping, harmonics, tablature, Guitar Pro,
  chromatic notes, and fret ranges were never implemented and remain outside
  this focused melody instrument.
