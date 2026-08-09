# V1 golden fixtures

These files were generated once from unmodified V1 code at commit
`81209c5bd5d2009706f50d4ae8362d2b433c3c06`, before V2 implementation began.
They are static compatibility inputs, not regenerated snapshots.

- `project-five-beat-history.v1.json` is an official schema-v1 project export
  with a five-beat Modern population, a two-parent evolved generation, two
  favorites, exact seeds/versions, and loop state.
- `local-storage-project-v1.json` is the exact value stored under
  `melody-forge:project:v1` for that project.
- `project-favorites-only.v1.json` proves that favorites survive independently
  of generation history.
- `candidate-modern-five-beat.v1.json` and
  `candidate-legacy-five-beat.v1.json` are official schema-v1 candidate
  exports. Both are exactly 2,400 ticks (five quarter-note beats), so V2 cannot
  silently reinterpret them as a complete 4/4 bar.
- `candidate-modern-five-beat.v1.mid` is the corresponding exact V1 format-0
  MIDI export, including tempo and trailing phrase duration.
- `candidate-modern-non-480-ppq.v1.json` proves that schema V1 accepted a
  positive safe-integer PPQ other than 480 while preserving exact musical
  positions (96 PPQ, 480 total ticks, five beats).
- `project-mixed-ppq-favorites.v1.json` puts otherwise compatible 96-PPQ and
  480-PPQ candidates in one valid V1 project so migration cannot assume one
  project-wide timing profile or silently rescale either favorite.

The source generator used public V1 generation, evolution, JSON, and MIDI
paths. It was removed after these artifacts were written. The two PPQ edge
fixtures were passed through those same unmodified V1 domain/schema codecs after
the source audit established that V1 intentionally accepts any positive safe
integer `ticksPerBeat`. The fixture hashes are recorded in `manifest.sha256`.
