# Melody Forge V2 user-interface specification

Status: reviewed normative M1 baseline — living implementation specification

Companion: `docs/V2_PRODUCT_SPEC.md`

Preserved history: the V1 screenshots, `docs/PRODUCT_SPEC.md`, and
`docs/MANUAL_QA.md` remain intact as the baseline being extended.

This specification describes complete screen behavior, not a static visual
concept. Every named control must invoke the real domain action, reflect the
persisted state, expose loading/error/cancellation behavior, and have an
accessible equivalent. Lines prefixed **Design decision** settle UI choices the
goal leaves open.

**Design decision — interpretation scope:** exact breakpoints, dimensions,
capacities, default view choices, copy patterns, and placements stated below are
intentional decisions wherever the product goal did not prescribe them. They
are implementation requirements, not provisional mockup values.

## 1. Experience goals

The interface should feel like a compact professional instrument: the current
music is always close to the transport; creative decisions dominate; technical
data is available without surrounding every card; and six complex evolutionary
workflows remain visibly different but structurally familiar.

The hierarchy is:

1. hear and orient;
2. focus and compare;
3. choose a creative action;
4. refine constraints;
5. inspect explanation and technical provenance.

The application must never become one giant settings form. Common creative
controls are visible, advanced controls are grouped by concern, and raw hashes,
genomes, seeds, formulas, and JSON appear only in explicitly opened technical
views.

## 2. Application shell

After a project exists, the oversized V1 landing hero is removed. A fresh
installation may show one compact welcome panel in the Create workspace, no
taller than 320 CSS pixels at 1440×900, with Legacy, Modern, Import MIDI, and
Start from Library actions. Generating or opening a project removes it for the
session.

The persistent shell contains, in visual and DOM order:

1. compact application header;
2. one shared sticky transport;
3. primary-destination navigation;
4. destination-specific Controls rail or sheet;
5. central creative workspace;
6. selected-item Inspector rail, drawer, or sheet;
7. compact branch/history strip.

There is exactly one global transport and one visible playhead authority. Cards
may have Play buttons, but those buttons control the shared transport rather
than creating local players.

### 2.1 Header

The desktop header is 52–60 CSS pixels tall and contains:

- Melody Forge wordmark, linking to Create without resetting state;
- editable project name, truncated visually but available in full to assistive
  technology and on focus;
- Project menu: New, Rename, Import project, Export project, and project storage
  status;
- Undo and Redo controls with action names in their accessible labels;
- History button showing the current branch name;
- Library button showing a badge only when unsaved favorites need attention.

Project menu commands are text-labelled; ambiguous icon-only controls require
tooltips and accessible names. New and Replace project require confirmation.
Rename saves on Enter or explicit Save and cancels on Escape without changing
musical identity.

### 2.2 Destination navigation

Create, Evolve, Explore, and Library are presented as a single tablist or
navigation landmark immediately below or within the header. The active item has
text, `aria-current="page"`, and a non-colour indicator. Navigation preserves
all mode state and does not stop playback.

Evolve opens the last-used Breed, Drift, Islands, or Pair Lab workspace.
Explore opens the last-used Map or Pareto workspace. A secondary workflow
tablist appears at the top of those destinations. Switching tabs restores the
mode's last focused item, scroll target where feasible, selections, and
controls; it does not run an operation.

### 2.3 Control rail

The left rail contains only controls that can affect the current destination
and workflow. Its header states the active strategy/mode and has Collapse. It
is independently scrollable beneath the transport, while the primary action
remains visible at its bottom when space permits.

Controls are grouped in this order when applicable:

- Common;
- Parents or Anchor;
- Change direction / Objectives / Axes;
- Locks;
- Tonality;
- Beat;
- Advanced mutation;
- Technical seed and version.

Common is open by default and is not a stored disclosure. Locks opens exactly
when at least one applicable lock is active; the concise tonal summary opens
exactly when tonic/scale differs from the mode default or borrowing/modulation
is active. Those two are derived from project state, not browser preferences.
Advanced mutation, relationship weights, borrowing rules, modulation details,
custom-scale operators, descriptor formulas, seed paths, and technical versions
are collapsed initially. A closed section summary reports non-default values,
for example “Tonal: E Dorian, borrowing 20%, one modulation.”

Closing a section does not reset its values. Reset applies only to the labelled
section and requires no confirmation unless it would remove an explicit lock or
adaptation; then the changed items are previewed.

### 2.4 Inspector

The right Inspector follows the focused candidate, beat, pair, archive cell, or
Pareto point. It never changes focus merely because the pointer passes over an
item. It contains these tabs when applicable:

- **Summary** — readable musical description, descriptors, annotations,
  ratings, favorite/Library actions;
- **Inheritance** — Parent A/B, mutation, remap, borrowed, elite, and repair
  contributions plus comparison-view choices;
- **Sound** — voice, articulation, accent, reverb, delay, melody/beat levels,
  and beat A/B;
- **Export** — candidate, component, pair, MIDI, WAV choices;
- **Technical** — complete provenance, hashes, genomes, formula versions,
  seed paths, and raw JSON.

Summary is default. Technical is never selected automatically and raw JSON is
rendered in a bounded copyable code region, not across ordinary cards.

On focus change, the tab remains the same if it applies; otherwise Summary is
selected and announced. Unsaved annotation edits prompt before changing focus.

### 2.5 History strip

The branch/history strip is sticky to the bottom of the workspace on desktop
and sits above mobile bottom-sheet triggers. It is 36–48 CSS pixels tall when
collapsed. It shows the active path as connected labelled nodes, branch points,
the current node, and an overflow count. Parent generation, Drift anchor,
Island round, Map batch, Pareto run, and Pair Lab round use distinct text labels
instead of relying on icons.

Selecting a node opens it without deleting later work. Evolving from an older
node displays “Creates a new branch from …” beside the primary action. A full
History drawer provides a keyboard-navigable tree, branch rename, and
annotations. Undo/redo controls do not live in this strip and are never
described as history navigation.

### 2.6 Browser presentation preferences

The only browser-local UI record is
`melody-forge:ui-preferences:v2`. Its complete 15-leaf shape and initial values
are fixed:

~~~ts
{
  version: 'ui-preferences-v2',
  values: {
    visualDensity: 'comfortable',
    reducedMotionOverride: 'system',
    views: { library: 'grid', map: 'visual', pareto: 'visual' },
    panelSizes: { controlsWidthPx: 244, inspectorWidthPx: 312 },
    disclosures: {
      transportMore: false,
      sound: false,
      beatAdvanced: false,
      createAdvanced: false,
      mutationAdvanced: false,
      tonalAdvanced: false,
      history: false,
      technical: false,
    },
  },
}
~~~

Density is `comfortable | compact`; reduced-motion override is
`system | reduce`; Library view is `grid | list`; Map and Pareto are
`visual | table`. Controls width is an integer `216…264` CSS pixels and
Inspector width is an integer `288…336` CSS pixels; responsive layout clamps
the rendered width further to the active breakpoint without rewriting the saved
preference. Every disclosure is Boolean. `history: false` means the full
History drawer starts closed, not that the required compact strip disappears;
`technical: false` means no Technical tab/disclosure is auto-opened. Missing
known paths use these defaults. Any unknown path or invalid present value resets
the complete preference record to these defaults without changing project or
Library state.

The 15-leaf count applies only to `values`; root `version` is metadata. The
generic 64-registered-path safety gate remains a future-codec defensive bound,
not permission for additional schema-2 leaves. Root keys are exactly `version`,
`values`, and `values` accepts only the shown paths. Canonical localStorage JSON
uses that declared key order, is compact, and has neither BOM nor trailing line
feed.

No project/candidate ID, destination, active workflow, musical control, seed,
rating, annotation, lock, selection, history position, playback state, or
creative data may appear here. The adapter preserves Unicode without
normalization, rejects unpaired surrogates, and applies the Product §20 byte,
path-count, nesting, and scalar limits before exposing values to React.

## 3. Responsive layout model

CSS layout follows available inline size, not device detection. There must be
no page-level horizontal scroll at any required viewport or at 200% zoom.

### 3.1 Wide desktop: 1,200 CSS px and above

- Three working columns below navigation and transport: left rail 224–264 px,
  center `minmax(0, 1fr)`, right inspector 288–336 px.
- Gaps are 12–20 px; workspace side padding is 16–24 px.
- The central column must retain at least 560 px. If it cannot, the Inspector
  switches to drawer behavior even before the nominal breakpoint.
- At 1440×900 and 1280×720, header, transport, destination tabs, primary mode
  controls, focused timeline, and at least the first candidate row remain
  reachable without overlap. Vertical scrolling is expected; sticky regions
  must not hide focused content.

### 3.2 Compact desktop: 900–1,199 CSS px

- Two columns: collapsible left rail 216–240 px and central workspace.
- Inspector becomes a right-side modal drawer, 320–min(420 px, 90vw), opened by
  the persistent Inspector button or item activation.
- At 1024×768, the focused piano roll remains at least 480 px wide when the
  control rail is open. The user can collapse Controls to enlarge it.
- Drawer opening does not resize or crush the timeline. It traps focus only
  while modal and restores focus to the invoking control when closed.

### 3.3 Tablet: 768–899 CSS px

- The central workspace is a single content column.
- Controls and Inspector use opposite-edge drawers opened by labelled toolbar
  buttons. Neither drawer is permanently allocated a narrow column.
- Islands uses tabs rather than three swimlanes. Map and Pareto prioritize their
  chart/list switch and make the accessible list a first-class view.
- At exactly 768 px, no two control panels are forced side by side and all
  dialogs fit within the viewport with internal scrolling.

### 3.4 Mobile: below 768 CSS px

- One central column with 8–12 px side padding.
- Header reduces to wordmark, project-name button, and overflow menu. Primary
  destinations remain text-labelled in a horizontally scrollable tablist whose
  own scrolling does not cause page overflow.
- Transport is compact and sticky beneath the header. Its primary row contains
  Play/Pause, Stop, position, Loop, and a More button; tempo, meter, exact
  length, levels, voice, and beat mute appear in the transport sheet.
- Controls and Inspector are bottom sheets with persistent 44 px labelled
  triggers. Only one sheet is open at a time. Sheets use at most 85dvh, have a
  visible drag affordance that is not the only close mechanism, an explicit
  Close button, internal scroll, focus containment, and focus restoration.
- Candidate cards are one per row. Actions wrap; Play, mode selection, Favorite,
  and More remain at least 44×44 px. Card metadata collapses before actions do.
- The history strip sits above the Controls/Inspector triggers and must not
  obscure the final card or system safe area.

**Design decision — breakpoint semantics:** 768 px is tablet, not mobile. The
390×844 required viewport exercises mobile bottom sheets. At 200% zoom a wider
screen naturally enters tablet/mobile layout through effective CSS width.

### 3.5 Small-height behavior

At 1280×720 and landscape tablet, sticky header, transport, and history together
must consume no more than 176 CSS pixels. Rails and drawers scroll internally;
popover content collision-flips and then becomes a dialog/sheet rather than
clipping outside the viewport.

## 4. Visual system and semantic states

V2 preserves V1's warm charcoal, cream, and amber identity while reducing
nested cards. Large regions use open space and subtle dividers; a bordered
surface is reserved for focused content, interactive cards, dialogs, or grouped
controls. Avoid a border around a section that contains multiple separately
bordered sections unless the outer boundary conveys modal or selected state.

### 4.1 Foundation tokens

The initial token intent is:

- canvas charcoal `#171612`;
- primary surface `#211f19`;
- raised surface `#2b2922`;
- cream text `#f7f1df`;
- muted text no darker than the WCAG-compliant equivalent of V1 `#bdb8aa`;
- divider `#454137`, strengthened where needed for non-text contrast;
- creation/primary amber `#e7b65a` with dark ink;
- active playback teal `#72cbb5`;
- Parent A cyan-blue;
- Parent B light violet;
- mutation lavender;
- retained elite green;
- error/stop/destructive coral-red.

Exact non-V1 semantic token hex values may be tuned during contrast testing,
but their semantic mapping and distinguishability are fixed. Text and icons
must meet WCAG 2.2 AA; meaningful graphical boundaries must meet 3:1 against
adjacent colors.

### 4.2 Required redundant cues

Colour is never sufficient:

| State | Colour role | Required non-colour cue |
| --- | --- | --- |
| Creation / primary action | Amber | filled button, action verb |
| Playing | Teal | Play icon changes to Pause/Stop, `Playing` label, moving or static playhead |
| Parent A | Cyan-blue | `A` chip and solid-top rule |
| Parent B | Violet | `B` chip and dashed-top rule |
| Mutation | Lavender | `Mutation` chip and dotted/hatch fill |
| Deterministic remap/repair | Amber/cream | wrench icon, double outline, `Remapped` or `Repaired` label |
| Borrowed note | donor accent | internal dot/diamond plus `Borrowed from …` text |
| Selected | cream/amber outline | checkmark and `Selected` text/pressed state |
| Elite | Green | double stripe and `Elite` chip |
| Favorite | Amber | filled star and accessible pressed label |
| Error / destructive / Stop | Coral-red | error icon or stop square and explicit text |

Patterns must remain legible at miniature-card scale and under deuteranopia,
protanopia, and tritanopia simulation. A user-selectable high-contrast pattern
legend is available from the piano roll and inheritance view.

### 4.3 Typography, spacing, and motion

- Use the existing system sans stack and monospace only for pitches, ticks,
  hashes, seeds, and JSON.
- Body text is at least 14 CSS px desktop and 16 px in mobile form controls to
  avoid zoom-on-focus. Dense metadata may be 12–13 px only when it is
  supplementary and has an accessible full label.
- Major workspace headings are 22–30 px, not hero display sizes. Candidate
  names are 15–18 px.
- Spacing uses a 4 px base; common gaps are 8, 12, 16, and 24 px.
- Motion is restrained to playhead movement, progress, drawer transitions, and
  small state transitions. No parallax, card reflow animation, or continuously
  pulsing selection.
- With `prefers-reduced-motion: reduce`, drawers appear without travel, charts
  update without tweening, card movement is immediate, and the playhead uses a
  discrete or static position indicator while its numeric position continues
  to update.

## 5. Shared transport UI

The transport is sticky directly below the header and spans the usable width.
It has one accessible `Transport` landmark and these desktop groups, left to
right:

1. Play/Pause and Stop;
2. `Bar n · Beat n` plus exact tick/elapsed position on demand;
3. Loop toggle;
4. tempo numeric input, 30–300 BPM, with validated change;
5. meter and grouping selector, with custom numerator and group count each
   bounded to 1–32 and positive groups required to sum to the numerator;
6. bars or exact loop-length control, explicitly showing a partial final bar
   and the canonical maximum of 256 full/partial bar spans;
7. master-volume slider/mute;
8. active melody-voice selector;
9. beat Mute/Unmute;
10. More popover with separately labelled Comparison/display grid, Swing
    subdivision, Swing amount, performance effects, and detailed beat settings.

Comparison/display grid edits only canonical `transport.gridTicks`; Swing
subdivision and Swing amount edit only `transport.swing`. The default summary
reads `Grid: eighth note · Swing: straight eighths` (`240` ticks for both) and
the technical readout exposes exact ticks. After initialization, changing Grid
does not silently move Swing subdivision and changing Swing subdivision does
not change Grid. Reset transport and input adaptation lacking explicit swing
reapply the documented grid/fallback initializer. Any Swing controls shown in
Beat are synchronized views of the same two `transport.swing` fields: both
locations update immediately, share one accessible description, and never show
divergent values, edit Grid, or create a beat-owned swing gene. Invalid grid
divisors, swing-pair divisors, or configurations exceeding 65,536 grid
opportunities remain uncommitted and show the exact bound and nearest valid
choices.

Changing tempo while playing shows no confirmation and keeps position. A meter,
grouping, or loop-length edit that would adapt events opens Apply transport
change with before/after bar grid and affected events. Cancel restores the
unedited values. An old arbitrary-length phrase displays, for example, `1 bar +
1 beat · 2,400 ticks`, never a rounded `2 bars`.

Every migrated V1 candidate shows `V1 timing · <n> PPQ` beside its exact length,
including `V1 timing · 480 PPQ`. Play and direct V1 re-export remain available
without adaptation. Any action that uses it in canonical V2 transformation,
beat pairing, evolution, or mixed comparison opens a 480-PPQ derivative preview
listing every source/result onset, end, duration, grid, loop endpoint, and
rounding decision. A 480-to-480 preview says `Exact factor 1 · no tick rounding`
but still names the new canonical derivative; it never reclassifies the source.
Cancel retains the compatibility candidate. The Technical inspector exposes
source PPQ and profile ID without crowding ordinary cards.

Play schedules only the focused item's `auditionTiming`. The project may retain
a canonical comparison transport while that field selects a solo V1 profile;
the transport then shows `Solo V1 timing · canonical comparison retained`,
disables beat/mixed-comparison actions with an Adapt action, and never draws two
playheads or advances two positions. A null audition timing shows `Choose a
candidate to play`. Compatibility timing always shows beat absent/muted and the
V1 compatibility voice. Returning focus to a canonical candidate selects its
canonical timing; retained comparison context is never silently overwritten by
the compatibility audition.

A preserved V1 tempo outside 30–300, loop over 256 canonical BarSpans, or
canonical grid proposal over 65,536 opportunities does not disable compatibility
Play or direct V1 export. Its derivative preview instead shows `Cannot create a
canonical derivative yet`, the measured value/bound, and explicit `Adapt tempo`
and/or `Adapt phrase length or grid` controls. Their before/after previews must
be confirmed; no field opens pre-clamped and Cancel leaves the source/project
unchanged.

Play/Pause has `aria-pressed`; Loop and Beat use native or correct switch state;
volume exposes its numeric percentage. Position updates use `aria-live="off"`
to avoid constant speech. Play, pause, stop, candidate change, loop completion,
and errors produce concise polite announcements in the shared status region.

On mobile, the primary row stays one line where possible. Position may shorten
to `2 · 3` visually but retains “Bar 2, beat 3” as its accessible name. Stop is
never hidden in More while audio is active.

## 6. Candidate presentation and focus

### 6.1 Standard candidate card

Every card contains, in order:

- candidate number and user name, origin/workflow chip, and state chips;
- miniature piano roll using the shared visual semantics;
- one-line tonal summary and meter/length summary;
- compact descriptor summary chosen for the active workflow;
- Play/Pause, mode-appropriate Select/Parent/Anchor action, Favorite, and More;
- optional rating control where the active algorithm consumes rating.

Cards do not display raw JSON, full hashes, or long provenance. More opens the
Inspector or a menu with Inspect, Save to Library, Seed/Open in…, direct
transform, and export actions. Card heights are stable within a grid; long names
truncate to two lines and metadata wraps in reserved space.

The entire card is not one giant button. It is a focusable article with
separate real controls. Clicking non-control card space focuses it and updates
the Inspector; double-click has no unique required action. `aria-labelledby`
points to the candidate name and `aria-describedby` includes origin, tonal
summary, duration, and selection/play state.

### 6.2 Focus and multi-state behavior

A clearly visible 3 px focus ring surrounds the active interactive element.
The focused card has a separate inner emphasis from selected, playing, parent,
favorite, or elite styles. Each state is named in chips and in accessible text.

Mode selection limits are enforced at the action:

- Breed: one Parent A and optional Parent B;
- Drift: one anchor;
- Islands: candidate pins per island, with the two-elite limit explained;
- Map: one focused cell/representative and independently pinned occupants;
- Pareto: any compare-tray items within the displayed capacity, without making
  them parents automatically;
- Pair Lab: one active melody, one active beat, and one active pair, with
  component favorites independent.

If a limit is reached, the attempted control remains unchanged and nearby text
names what must be deselected. Selection never silently evicts an earlier item.

## 7. Piano-roll timeline

### 7.1 Focused timeline anatomy

The large focused-candidate timeline contains:

1. tonal-context track;
2. bar, beat, odd-meter grouping, and subdivision ruler;
3. pitched-note/rest canvas;
4. optional collapsed drum lane;
5. horizontal scrollbar/zoom only when the exact loop cannot remain readable;
6. view legend and accessible-data switch.

Pitch is vertical with labelled octaves and MIDI/note names. Time is horizontal
in integer ticks. A note block's left edge is onset and width is exact duration.
Rests occupy their full duration as low-contrast hatched blocks in a labelled
rest row rather than invisible gaps. Stronger bar/group/beat lines use weight
and labels, not colour alone. A final partial bar is visibly bracketed and
labelled `Partial`.

The synchronized playhead spans tonal, melody, and drum tracks. It uses teal,
an arrowhead, and numeric transport position. Seeking is available through a
labelled ruler control but the piano roll is not a note editor: dragging note
blocks, changing pitch, resizing, and creating events are not offered.

### 7.2 Tonal and provenance rendering

The tonal track labels every root/scale region and boundary, for example `Bars
1–2 · E harmonic minor` and `Bars 3–4 · E Phrygian dominant`. Custom scales show
their label and formula on focus. Modal borrowing appears on the note block and
in the tonal track's donor legend without replacing the base-scale label.

Blocks can simultaneously show source and musical status through layered cues:

- Parent A or B source top rule and letter;
- mutation hatch;
- borrowed diamond;
- deterministic repair double outline;
- retained elite side stripe;
- selected region handles that do not imply direct note editing.

When layers conflict, labels and the Inspector list all of them. A tooltip must
not be the only source of exact information.

### 7.3 Inheritance views

The Inheritance tab offers:

- Child only;
- Overlay Parent A;
- Overlay Parent B;
- Side-by-side A, B, Child;
- Pitch differences;
- Rhythm differences;
- Tonal-context differences.

Overlay uses outlines/patterns and never obscures child durations. Side-by-side
shares the same horizontal tick scale and aligned bar grid. Difference views
include a count and textual change list. An incompatible unadapted parent uses
its own source ruler above the explicit adaptation ruler; it is never visually
stretched without a label.

### 7.4 Exact information and accessible alternative

Pointer hover or keyboard focus on an event exposes pitch/MIDI, scale degree,
onset tick plus bar/beat, duration ticks/beats, velocity/accent, active tonal
context, source parent, mutation operator, borrowing donor/resolution, and
repair/adaptation. The same information is always available in an `Events`
table adjacent to or below the visualization.

The table is keyboard reachable and sortable by onset, pitch, source, or
status. It uses one row per melody event including rests, and optional separate
beat rows grouped by lane. `Show data table` is visible, not screen-reader-only.
The SVG/canvas itself has a concise summary and does not expose hundreds of
unusable graphic nodes when the table is the operable alternative.

### 7.5 Event and timeline-region locks

`Locks` contains an `Events and regions` group. Every Events-table row has a
labelled `Freeze event <summary>` checkbox; focused roll events expose the same
toggle through a visible action and `L`, while `L` is ignored in editable
fields. Multi-select uses row checkboxes plus Select all/Clear selection and
never requires modifier keys. `Freeze selected events` creates one lock listing
stable event IDs. Removing the lock does not delete or deselect events.

`Freeze timeline region` opens start and exclusive-end controls in bar, beat,
tick form plus exact absolute-tick readout. Buttons set Start/End from the
playhead or selected event bounds. Start must be less than end and both clamp
only after explicit confirmation to `[0, loopTicks]`; invalid order remains in
the dialog with a remedy. Two range handles are optional pointer/touch
shortcuts, with 44×44 px targets and arrow-key fine movement, but the numeric
controls are always the authoritative equivalent. Confirm previews the events
and partial events covered and whether pitch, rhythm, or both bytes will freeze.
The preview states `Intersecting events are frozen as whole genes; events are
not split at region edges`. A span that merely touches start or exclusive end is
not included; a span that crosses either edge is listed once with its complete
PitchGene and/or RhythmGene fingerprint. Proposed insertion, deletion, re-ID, or
boundary crossing that changes a scoped whole gene appears as a conflict, so a
visual partial overlap can never disguise a partial lock.

The lock summary lists each event lock and half-open region separately with
Edit and Remove. Overlaps are preserved as authored but display their union and
the number of multiply covered events. Before any operation, a conflict preview
lists exact event IDs/ranges, the requested operator, and `Review locks`; it
never silently weakens or splits a lock. Keyboard and touch users can create,
inspect, edit, and remove every lock without dragging the roll.

Miniature card rolls use the same bar, note/rest, tonal, inheritance, borrowing,
repair, elite, and playhead semantics at reduced detail. Their accessible label
summarizes the notes, duration, tonal movement, and notable provenance.

## 8. Create destination

The Create workspace top switcher contains Legacy, Modern, Import MIDI, and
Library. Legacy and Modern show the preserved V1 controls. Meter/exact length,
beat, and performance are clearly outside the generator strategy so changing
them cannot imply a regenerated melody.

### 8.1 Before and after generation

Before generation, the center shows an explanatory empty state and the left
rail's Generate action. Common controls are tonic, scale, event count, phrase
length where applicable, population, and a short meter/beat summary. Seed,
register, grid, rests, leap, closure, detailed tonality, and beat variation live
in labelled disclosures according to frequency.

After generation, settings collapse into a single summary row immediately
above candidates, for example `Modern · C Ionian · 8 events · 1 bar 4/4 ·
paper-kite`, with Edit and Generate new branch. The focused large timeline and
candidate grid appear near the top of the viewport. Reopening Edit does not
move or discard candidates.

### 8.2 Direct-transform menu

The focused candidate's `Transform` menu lists Keep rhythm/new pitches, Keep
pitches/new rhythm, Remap tonic, Remap scale, Near/Medium/Far, Continuation, and
Answering phrase. Each opens a compact preview showing frozen components,
target context/length, child count, and exact primary-action wording. Results
appear in a new branch and can be cancelled before commit.

## 9. Breed workspace

Wide layout places Parent A and Parent B slots in one row above the offspring
grid. Each slot shows its candidate miniature, tonal/transport compatibility,
Play, Replace, Clear, and lock summary. An empty Parent A slot says `Choose a
parent from the population or Library`; an empty Parent B says `Optional — add
for crossover`.

Below the slots, adaptation status and crossover contribution controls precede
the focused timeline and grid. The primary button reads `Breed 8 descendants`
or `Mutate 8 descendants` according to parent count. At zero mutation it changes
to `Copy selected parent(s)` and explains that crossover is off and exact
deduplication may yield an intentionally underfilled result.

An incompatible second parent immediately shows a non-destructive warning with
`Preview adaptation`; Breed remains unavailable until preview is confirmed or
Parent B is removed. The preview is a dialog on desktop and full-height sheet
on mobile, with source and adapted mini rolls, child transport, timing policy,
tonal strategy, register repairs, locks, and changed-event list.

Offspring cards show A/B contribution bars with labels, Mutation, Remapped,
Repaired, and Elite chips. Inheritance view defaults to Child only and never
expands raw provenance on every card.

On mobile, parent slots stack A then B, followed by compatibility and primary
action. The offspring grid is one column. Parent slots remain reachable through
a `Parents` jump link rather than sticky overlays.

## 10. Drift workspace

The top region contains one pinned anchor card and a horizontal breadcrumb
trail of prior anchors/branches. The center presents three explicitly labelled
Near, Medium, and Far bands with their numeric distance ranges and component
distance summaries.

At wide desktop the bands are three columns when each can remain at least
240 px; otherwise they are vertical sections. Cards have Play, Promote to
anchor, Favorite, and Inspect. Merely focusing or playing never promotes.

Bias controls show Pitch, Rhythm, Motif, Tonal context, and Mixed as a radio
group with a sentence describing which operators and distance components are
emphasized. The primary action is `Generate Near, Medium & Far from [anchor]`.

Promote opens a brief confirmation only when it would branch from a non-current
trail node; otherwise it immediately adds the anchor node and announces that
the old trail remains. Reopening any breadcrumb restores its descendants and
offers `Branch from this anchor`.

## 11. Islands workspace

At 1,200 px and wider the center shows three equal swimlanes: Conservative,
Rhythmic, and Adventurous/Tonal. Each lane header contains policy summary,
generation, diversity, Evolve island, and up to two pinned-elite indicators.
Cards remain readable at a minimum 240 px; if not, the layout changes before
crushing them.

Migration appears as a labelled connector or summary row between lanes with
candidate name, source, destination, generation, and accepted/queued status.
Animation is optional and removed under reduced motion; text is authoritative.
Pinned elites cannot be drop targets for replacement.

`Evolve all islands` is the prominent shared primary action. Its progress lists
the current lane and stable 1/3, 2/3, 3/3 completion. Each lane can cancel its
own independently initiated run; cancelling Evolve all cancels remaining work
and commits no part of the global round.

**Design decision — atomic global run:** the default Evolve all behavior is
the only Evolve all behavior and is atomic. All three next populations validate
before the history node commits. Individual Evolve island actions remain
separate complete operations with their own history nodes.

The workspace displays `Global diversity` with formula link, current value,
`Healthy` or `Below 0.18`, generation vector, and last immigrant action. Its
details list each `(island, candidate)` membership's cross-island nearest-
neighbor contribution and explain that exact duplicates on different islands
remain separate zero-distance memberships. The value is descriptive. A below-
threshold global round previews the one eligible deterministic immigrant/
replacement; pinned elites and underfilled fallbacks are named. When no island
has an unpinned replaceable survivor, the panel says `No replaceable survivor ·
all eligible positions are pinned` and records no population change. Per-island
and global diversity are never conflated.

At 1,199 px and below, lanes become an accessible tablist with counts,
generation, migrant badge, and pinned-elite count. A persistent migration
summary remains below the tabs so cross-island activity is not hidden.

## 12. Map workspace

Map's wide layout is a large descriptor archive linked to the Inspector. Axis
selectors and Generate controls sit above it, not inside every cell. The 8×8
grid labels both ends and intermediate bin ranges. Empty cells have a subdued
`Empty` label and remain focusable only when region selection is active.
Occupied cells show a miniature roll, candidate short name, rating if any,
pin state, and challenger count.

Keyboard focus uses a roving tabindex. Arrows move by cell; Home/End move to row
edges; Ctrl+Home/Ctrl+End move to archive corners. Enter auditions an occupied
cell or opens the empty-cell region action. Space toggles playback for the
focused occupant. Multi-cell region selection has a visible anchor and count.

Selecting a cell updates the Inspector with bounds, exact descriptor values,
representative, three challenger positions, replacement evidence, pin action,
and `Generate around cell`. Bounds use the exact eighth intervals, with only the
last bin closed at 1. The Inspector shows normalized Euclidean center distance
and the occupied orthogonal/diagonal neighbors used in mean phenotype novelty.
Pin uses a pin icon plus text and prevents replacement.

Changing axes opens a small re-bin preview stating candidate count, occupied
cells before/after, and that no candidate will be deleted. Re-bin progress is
cancellable; cancellation leaves the old view and archive unchanged.

Coverage and diversity are shown as neutral measurements with formula/version
links; the words score, quality, and best are not used. Diversity has a labelled
policy selector: `Phenotype (default)` or `Selected descriptor plane`. Help text
states that it averages unordered pairs of occupied representatives, excludes
challengers, and returns zero below two occupants. A `Grid | List` switch is
always visible. List view is a sortable table with one row for each of the 64
empty or occupied cells and columns for bin coordinates, axis bounds/values,
name, occupancy role, rating, pin, challenger count, Play, Inspect, and region
generation. It exposes every archive action available in the grid.

On mobile the List view is default. Grid view is available through a labelled
scroll/zoom region with sticky axis labels, but no requirement depends on
pinch-only gestures.

## 13. Pareto workspace

The left controls define two to four objectives. Each objective row has
descriptor, Minimize/Maximize/Approach target/Stay in range, target or lower/
upper inputs where required, drag-independent Move up/down controls, and Remove.
`Stay in range` is labelled `objective distance: 0 inside range`; it does not
change feasibility. Add objective is unavailable at four and explains the
limit. Hard constraints are a separate labelled group with rows for normalized
descriptor minimum/maximum, maximum leap, and maximum borrowed duration. Every
row shows unit, normalization denominator, user order, Move up/down, and Remove.
The group explains that locks/domain invariants are validated before these
Pareto constraints and shows the ordered violation vector used for infeasible
candidates.

The center shows a linked scatterplot and frontier table. Two selected display
axes appear in dropdowns above the chart; changing them changes presentation
only. The legend distinguishes Trade-off frontier, Dominated, Constraint
violation, Focused, and Compare tray with shape and line style as well as
colour.

Every point is keyboard focusable through a roving collection. Arrow keys move
to the nearest point in the chosen direction using deterministic chart
coordinates; Enter inspects; Space auditions; C or the visible action toggles
Compare tray. A focus halo, point shape, candidate label, and accessible status
identify focus.

The Inspector shows all active objective values/directions, constraint
violations, Pareto rank, crowding distance, dominance relationship, descriptors,
and provenance. An infeasible row shows `Rank: not assigned` and `Crowding: 0`,
never a synthetic rank or frontier membership. Its explanation gives violation
sum and ordered vector before any preference tie-break. It says `Trade-off
frontier`, never `best`.

The `Chart | Table` switch is always visible. The accessible table contains one
row per candidate and columns for all objectives even when only two are chart
axes, constraint status, rank, crowding, frontier/dominated status, Compare,
Play, and Inspect. Sorting is presentation-only.

Compare tray is a docked row on desktop and collapsible tray above mobile sheet
triggers. It shows up to four candidates by default, Play, Remove, Blind A/B for
two chosen items, and Clear; tray membership has no algorithmic effect until
the user provides explicit feedback.

Run summaries separate feasible survivors, retained valid-but-infeasible
survivors, domain/lock rejections, and missing slots. In an infeasible-only
parent tournament the explanation shows violation sum/vector before preference;
preference is displayed only as an equal-violation tie-break. If a one-run
exclusion would remove every entrant, the summary states that it was ignored for
that tournament. Underfill says `Constraints were not relaxed` and offers Edit
constraints or another run without inventing rank, crowding, or duplicates.

## 14. Pair Lab workspace

Wide layout uses three distinct panels:

- Melody population on the left;
- active pair and combined piano-roll/drum view in the center;
- Beat population on the right.

The center is visually dominant and names both component IDs. Melody-only,
Beat-only, and Together are a three-option audition group. Swap partner changes
only the selected partner and stops/reschedules through the shared transport.
Meter, tempo, loop, and PPQ compatibility are shown above the pair.

Each melody card has Prefer melody and Save melody actions. Each beat card has
Prefer beat, Save beat, and a compact lane-density pattern. The active pair has
Prefer pairing, Reject pairing, Save pair, and partner evidence. These four
feedback controls are text-labelled and never collapsed into one rating.

Lock mode controls are Lock beat/evolve melodies, Lock melody/evolve beats, or
Evolve both. Beat-layer freezes list the four exact groups Kick, Snare/Clap,
Hats (closed + open), and Auxiliary (tom + percussion) with locked icons/text.
Enabled-lane controls remain five distinct rows, so the grouped Hats lock never
implies that closed/open hats are one event lane. The primary button exactly reflects the state, such as
`Evolve 8 melodies with locked beat`.

The Inspector separates Melody lineage, Beat lineage, Pair evidence,
Collaborator schedule, and Hall of fame. No combined “fitness” badge is shown
without those components.

Hall-of-fame details show the exact replacement key. Melody/beat entries show
named positive component evidence, distinct successful opposite-component IDs,
admission generation, and ID. Pairing entries instead show Prefer-pairing count,
Reject-pairing count, admission generation, and pairing ID; they never display
or sort by a fictitious distinct-collaborator count. A rejected admission names
the last-ranked incumbent it failed to outrank.

At 900–1,199 px, the active pair stays full width above side-by-side component
tabs. At tablet/mobile, Melody, Pair, and Beat are an accessible tablist; a
compact sticky pair bar always names the selected partners and audition mode.

## 15. Blind A/B tournament

Blind A/B opens a distraction-free dialog/sheet over the current mode without
destroying its state. It displays neutral labels A and B, the shared transport,
same voice and normalized levels, and one piano roll at a time or equal-sized
rolls without origin cues. The fairness summary is scope-specific: Melody shows
`Same locked beat`; Beat shows `Same melody`; Pair shows `Same transport and
routing` while allowing both melody and beat components to differ. It never
claims beat equality during a beat or complete-pair comparison.

Hidden until decision: names, IDs, order in population, parent labels,
inheritance styling, workflow/island, rating, favorite, and provenance. Musical
content such as borrowing that is audible may remain visible only in neutral
note styling; source-specific styling is suppressed.

Controls are Play A, Play B, replay, A, B, Neither, Both, and Cancel. Selection
requires an explicit button; playback order does not auto-select. After the
decision, a Reveal panel displays names, origin/provenance, actual shuffled
order, comparison scope, and the exact mode row/state delta from Product
Specification section 15.1. Continue commits that `PreferenceRecordV2`;
Undo feedback is available through normal undo. Neither is never presented as
an inert close action: the Reveal states its one-run exclusion, negative
operator evidence, or pair rejection according to mode/scope.

The Reveal fairness details show transport, performance, normalized-level, and
scope-context fingerprints in readable summaries, with raw hashes in Technical.
After commit Technical also exposes version `preference-record-v2`, stable
record ID, and the allocated project occurrence ordinal. Repeating an identical
decision therefore produces a distinct ordinal/ID; Undo removes its active
effect but does not make that ordinal reusable.

The dialog traps focus, announces which neutral candidate is playing, and uses
no timed decision. Escape cancels only before a feedback commit.

## 16. Continuous audition

Continuous audition starts from a selected population, Map region, Pareto
front/table selection, Library results, or Compare tray. A compact audition bar
appears above the history strip and contains position `3 of 12`, candidate
neutral/name label as appropriate, loop count, Previous, Skip/Next, Favorite,
mode-appropriate Parent/Anchor, and Stop.

The playing card/point/cell is scrolled into view only when doing so will not
move keyboard focus or interrupt an edit. It is always marked with Playing text
and teal playhead. The queue advances after the configured one or two complete
loops. Manual Play outside the queue pauses audition and asks Resume queue or
End audition; it never leaves two schedules active.

Stop cancels current audio and auto-advance immediately while retaining the
queue for Resume. End audition clears only transient queue state. Favorites and
parent/anchor selections made during audition persist normally.

## 17. Library destination

The Library toolbar contains search, filter button, active-filter chips, Sort,
Grid/List switch, and result count. Search covers name and annotation. Filters
include name text, tonic, catalogue/custom scale, meter, origin, workflow mode,
and Favorite. Clear all is visible when any filter is active.

The default view is a dense responsive grid; List provides sortable columns.
Each item shows name, favorite, tonal/meter summary, origin, miniature roll or
beat lanes, note preview, Play, Open, and More. Pairing items show linked melody
and beat miniatures without merging their identities.

More offers Rename, Edit note, Favorite, Open, Use as Breed A/B, Use as Drift
anchor, Seed Islands/Map/Pareto/Pair Lab, Use beat as shared beat where
applicable, Export, Remove from this project, and Delete from Library…. The
global delete requires confirmation. Incompatible seed actions open adaptation
preview. Rename and notes save explicitly and preserve candidate identity.

An empty Library distinguishes `Nothing saved yet` from `No results match
filters`, offering Create/Open current candidate in the first case and Clear
filters in the second. V1 migrated favorites have a `Migrated favorite` origin
detail but no reduced functionality.

Library items are global, not children of the open project. `Remove from this
project` removes only its ordered project reference; `Delete from Library…` is
the separately labelled confirmed global action. Deleting or replacing a
project never presents Library rows as collateral deletion. Project export
summarizes the referenced Library rows it bundles. Import collision copy
distinguishes `Existing identical item — origins will be merged` from
`Conflicting content uses the same ID — import stopped`.

## 18. Beat and sound controls

The transport exposes voice and beat mute; detailed settings live in the Sound
Inspector and a Beat disclosure. Beat controls are grouped:

- Mute/Unmute and Lock beat;
- family, density, the five enabled-lane checkboxes Kick, Snare/Clap, Closed
  hat, Open hat, and Auxiliary, the synchronized `transport.swing` amount and
  subdivision view, and the exact fill choices Never, Every 2 bars, Every 4
  bars, Every 8 bars, and Final bar only;
- Previous, variation index, Next, Regenerate, variation strength, and seed in
  Advanced;
- melody/beat A/B slots where useful;
- the four lock groups Kick, Snare/Clap, Hats (both hat lanes), and Auxiliary
  only in Pair Lab.

Enabled lanes serialize in that displayed order. The final checked lane cannot
be unchecked and explains `Mute or remove the beat to make accompaniment
silent`; performance Mute never edits the enabled-lane set.

Previous and Next state the target variation index. Regenerate warns that it
changes the beat seed but not melody. Changing beat controls shows `Melody
unchanged` in the resulting status. Ordinary population cards show one shared
beat chip rather than implying individual beats.

Voice cards/select options contain name and short character description, not
synth parameters. Choosing a voice while playing stops/reschedules the same
candidate at its retained tick and announces the voice. Articulation, accents,
reverb, and delay show percentages/subdivision and their bounded ranges.

The initial Sound summary is exactly `Soft Pluck · Articulation 55% · Accents
35% · Reverb 10% · Delay off`. Expanded defaults are reverb enabled, 10% wet,
`tailTicks = 960`; delay disabled, 0% wet, `delayTicks = 240` (eighth note),
feedback 20%; melody 82%, beat 68%, effects return 20%, master 80%.
Articulation, accents, and all four bus levels accept integer `0…100`%; reverb
wet `0…30`%; delay wet `0…25`%; feedback `0…75`%; reverb tail integer
`120…3840` ticks; delay subdivision exactly `120`, `240`, `480`, or `960`
ticks. Turning an effect off preserves and continues validating its wet,
tail/subdivision, and feedback values. UI labels show both musical subdivision
and exact tick value; no control stores seconds as the musical setting.

Migrated V1 material initially shows `V1 Triangle (compatibility)` as an
internal playback-preservation option. It is not counted among the six curated
V2 choices and cannot be selected for new material. Choosing any curated voice
is an explicit performance-only change; Restore compatibility remains available
for that migrated candidate and never claims V1 stored a synth preference.

## 19. Tonality, borrowing, modulation, and custom-scale UI

The common tonal summary shows tonic, scale, and independent lock icons/text.
An `Evolve tonality` switch makes tonic and/or scale available as genes; its
expanded options never silently remove an existing lock.

The relationship picker is a graph only when the graph improves selection. It
also always has a sortable list with relationship name, distance, shared pitch
classes, added/removed pitch classes, parallel/relative/mode/fifths evidence,
and Select. Low/Medium/High mutation bands are visible. Custom nodes use the
same controls and labels as catalogue nodes.

Band help is exact: Low shows one direct `0 < d <= 0.25` draw weighted by
`1 - d`; Medium shows two labelled `0 < d <= 0.50` hops weighted by `1 - d`,
with immediate-backtrack and return-to-source exclusions; High shows one
complete-graph draw weighted by direct distance `d`. A result explanation lists
eligible/fallback band, each hop, normalized probability, and stable-ID tie
order rather than only saying near or far.

Borrowing controls always name Base and Donor separately. Amount zero visibly
reads Off. Donor-exclusive, strong beats, resolution time, and tonic-boundary
controls have short inline explanations. The candidate summary and piano roll
state actual borrowed pitches and donor, not merely “borrowing used.”

Modulation uses an ordered segment list aligned with the tonal track. Add,
Remove, Move boundary, Destination, and Return to opening controls show affected
bars. A phrase with fewer than two full bars shows the exact reason and an
optional Adapt phrase length action; Add remains unavailable with that nearby
explanation.

Custom Scale opens a focused editor constrained to the 12 pitch classes. Tonic
bit zero is selected and locked; cardinality counter states `n of 4–9`; illegal
fourth removal or tenth addition is blocked with explanation. The view includes
interval formula, compact keyboard/pitch-class circle, catalogue match/aliases,
parent scales, and operator change list. This is a constrained scale-set editor,
not a general synth or note editor.

The editor also runs `custom-scale-degeneracy-v2.0.0`. A contiguous chromatic
cluster shows `Spread at least one pitch beyond this chromatic cluster`, marks
the covering arc without relying on colour, and blocks Save/Use. Generated or
imported invalid masks show the deterministic one-class repair as a before/after
preview with Move class, Keep source/Cancel, and lock-conflict explanation.
Empty, full-chromatic, wrong-cardinality, duplicate, missing-tonic, and
degenerate errors have distinct messages and focus the relevant control.

## 20. Import and export UI

### 20.1 MIDI import wizard

Import MIDI is a four-step dialog/sheet:

1. **File** — choose local `.mid`/`.midi`, show the 5 MiB (5,242,880-byte)
   limit and measured size/type feedback, then Parse or Cancel.
2. **Track** — list every track/channel with pitched-event count, drum marker,
   duration, and detected polyphony; choose one pitched track.
3. **Adapt** — show tempo/meter events, PPQ conversion, event table/mini roll,
   proposed quantization, phrase length, tonic/scale matches, register changes,
   and every snap/trim/pad/conversion. Polyphony requires Reject, Highest,
   Lowest, or Earliest-onset strategy. Before confirmation the event table shows
   the source-boundary sweep and marks every note Kept, Discarded, Shortened, or
   Split with each resulting source-tick fragment. Help states Highest = pitch
   descending then source event order, Lowest = pitch ascending then source
   event order, and Earliest = onset then source event order then pitch; a note
   that loses and regains priority remains separate fragments.
4. **Confirm** — concise before/after summary, checked destructive adaptations,
   resulting transport/tonality, `Import as candidate`, and Cancel.

Unconfirmed destructive rows use warning icons and prevent confirmation with a
nearby link. Bound errors separately name: over 64 tracks, over 200,000 total
events, per-event delta over `0x0fffffff` ticks, total duration over 4,096 source
quarter-note beats, PPQ outside 1–32,767, SMPTE division, or format 2. The error
shows measured value, exact limit, file/track/event where applicable, and
`Project was not changed`; no track list or adaptation state commits. Other
errors likewise identify file, track, event/time, and remedy. Cancel at any step
closes the wizard and announces that the project was unchanged.

### 20.2 JSON import

Project JSON, Candidate JSON, Pair Lab Melody Component JSON, Pair Lab Beat
Component JSON, and Pair Lab Pairing JSON are separate menu items and file
inputs. The three Pair Lab item imports are available from Pair Lab and Library,
validate only their exact envelope kinds, preview timing/reference resolution,
and offer Save/Open/Pair without replacing the project. A wrong component kind
links to the matching importer but never dispatches implicitly. After
validation, project import shows project name, schema/version, branch/candidate/
Library counts, transport, migrations, warnings, storage estimate, and `Replace
current project`. Candidate import shows musical summary and Open, Save to
Library, or Seed actions; it never replaces the project on selection.

The picker/helper text states 50 MiB for project JSON and exactly 5 MiB
(5,242,880 bytes) separately for Candidate, Pair Lab Melody Component, Pair Lab
Beat Component, and Pair Lab Pairing JSON. Oversize is checked on raw file bytes
before UTF-8 decode or parse and the error names the selected envelope command;
a pairing envelope receives no larger implicit allowance because it bundles two
components.

Malformed JSON, wrong envelope kind, unsupported version, invalid references,
duplicate conflicting identities, hard-invariant failure, oversized input, and
storage-quota failure have distinct messages. Every failure includes `Current
project was not changed` and retains a Retry/Choose another file action.

### 20.3 Export

Export is opened from Project, candidate/Inspector, Library item, or Pair Lab
component. The dialog first establishes scope:

- Project JSON;
- Candidate JSON;
- Melody MIDI;
- Melody + beat MIDI;
- Melody WAV;
- Melody + beat WAV;
- Pair Lab melody component, beat component, or pairing JSON as applicable.

Unavailable options state why, such as `No beat is attached`; they are omitted
only when not applicable to the selected object. MIDI summary displays tempo,
meter/grouping, PPQ, exact duration, and tracks/channels. WAV displays loop
passes, effect-tail 0–4 s, calculated duration, and Render.

Each Pair Lab JSON export preflights its canonical UTF-8 envelope against the
same exact 5,242,880-byte per-envelope limit used by import. An oversized
melody component, beat component, or pairing names that scope and offers smaller
component export where applicable; it creates no partial download.

WAV rendering shows phase and progress with Cancel. Cancel revokes temporary
resources and produces no download. Success names the file, format, duration,
and scope. Popup/download blocking produces a retryable error without rerendering
or changing project state.

## 21. Progress, cancellation, empty, and error states

Long operations use a stable inline progress region near the initiating action
and an optional global task indicator. It contains operation name, completed
work or current phase, elapsed-free progress wording, Cancel, and `You can keep
listening` when true. It does not promise time remaining unless measured
reliably.

The initiating primary button becomes a status control, not a second runnable
action. Cancel is always reachable by keyboard and touch. A stale or cancelled
worker result produces no card flash, history node, toast claiming success, or
selection change.

Required screen states and copy pattern:

- no project: `Start with Legacy, Modern, MIDI, or Library`;
- no population: `Generate or open a candidate to begin`;
- no Breed parent: `Choose Parent A to enable mutation or breeding`;
- no Drift anchor: `Pin one candidate as the Drift anchor`;
- empty Map: `Generate a batch to fill descriptor cells`;
- no Pareto run: `Confirm 2–4 objectives, then generate a population`;
- empty Library: distinguish empty storage from zero filtered results;
- incompatible material: state dimensions that differ and open Preview
  adaptation;
- impossible locks: list exact conflicting locks and direct `Review locks`;
- cancelled: `Cancelled — no result was committed`;
- invalid import: specific cause plus `Current project was not changed`;
- audio failure: Retry audio from a visible user-gesture button;
- IndexedDB storage failure: state `V2 project data was not redirected to
  browser preferences`, preserve the last commit/in-memory work, and offer
  Export project and Manage Library actions;
- pending migration read-back/activation: state `Migration is staged but not
  active — your previous project is unchanged`, with Retry verification and
  Export V1 recovery actions; never render the pending project as active;
- invalid/unavailable `melody-forge:ui-preferences:v2`: reset presentation
  preferences to defaults without a project warning or domain-state change;
- export failure: scope/format-specific cause and Retry.

Use a polite live region for success/status and an assertive region only for an
error that blocks the current action. Toasts may supplement but never replace
inline errors, and must not contain the only available action.

## 22. Keyboard model

Global creative shortcuts, shown in a Help/Shortcuts dialog and relevant
tooltips, are:

- `1`–`9`: audition the corresponding visible candidate;
- `Space`: play/stop focused candidate or chart point;
- arrow keys: move focus through the current candidate grid, Map cells, or
  Pareto points;
- `P`: select Parent/Anchor or mode-equivalent pin action;
- `F`: toggle Favorite;
- `E`: invoke the currently labelled primary evolution action;
- `Escape`: close the topmost menu/dialog/sheet or cancel transient selection,
  never stop audio unless focus is in the transport and the control says so.

Number shortcuts beyond nine are available through visible Play controls.
Shortcuts do not fire when focus is in `input`, `textarea`, `select`, content
editable content, a code editor, or a modal that has its own keystroke contract;
nor with Ctrl/Alt/Meta except documented chart navigation. Typing Space on a
button activates the button normally rather than the creative shortcut.

Candidate grids use logical row/column arrow movement with a roving tabindex;
Tab moves among the card's actions without requiring every non-interactive card
surface in the tab order. Tables use native table navigation plus focusable row
actions. All drag-reorder behavior has Move up/down buttons.

## 23. Accessibility requirements

The complete interface targets WCAG 2.2 AA.

### 23.1 Structure and naming

- One `h1` names the application/project; destination and workflow headings
  descend without skipped levels.
- Header, destination navigation, transport, Controls, main workspace,
  Inspector, History, status, and footer/help use appropriate landmarks and
  unique accessible labels.
- Every input has a persistent visible label; placeholders are examples only.
  Units and valid ranges are programmatically connected.
- Native buttons, radios, checkboxes, selects, details, tables, and dialogs are
  preferred. Custom tablists, grids, charts, switches, and drawers implement
  their full ARIA and keyboard patterns.
- Disabled primary actions have adjacent explanatory text connected through
  `aria-describedby`; essential help is not placed only in a disabled tooltip.

### 23.2 Focus and dialogs

- Every interactive element has a visible focus indicator at least 2 CSS px
  thick with sufficient contrast and not obscured by sticky UI.
- On navigation, focus stays on the invoked destination tab and the new heading
  is announced. An optional Skip to workspace link precedes navigation.
- Dialogs/drawers/sheets receive initial focus on their heading or first
  meaningful field, contain focus while modal, close by explicit button and
  Escape where safe, and restore focus to the invoker.
- Opening History, Inspector, or Controls does not unexpectedly move playback
  focus. Validation moves focus to the first invalid field and provides a
  summary linked to each error.

### 23.3 Perception and input

- Normal text meets 4.5:1 contrast; large text 3:1; UI components and meaningful
  graphics 3:1. Parent/mutation/borrowed/elite states pass colour-vision checks
  through labels and patterns.
- Pointer/touch targets are at least 44×44 CSS px, including piano-roll event
  focus proxies, chart points, card menus, sheet triggers, and dismiss buttons.
  Closely packed visual chart points may use 44 px invisible hit regions without
  distorting data position.
- Hover content is also available by focus, dismissible, hoverable where
  required, and never the sole access to exact event information.
- No action requires path dragging, multi-touch, or motion. Region selection,
  reorder, sliders, and playhead seek all have discrete controls or numeric
  alternatives.
- Browser text zoom to 200% causes reflow, not clipped content or two-dimensional
  page scrolling. The piano roll/chart may have a labelled internal horizontal
  scroll region when data itself is two-dimensional.

### 23.4 Dynamic audio and charts

- Status announcements cover play, pause, stop, playing candidate, favorite,
  parent/anchor selection, generation completion, migration, import/export,
  cancellation, and errors. Playhead position is not continuously announced.
- Map has a fully actionable sortable list; Pareto has a fully actionable table;
  piano rolls have event/tonal/beat tables. These alternatives expose the same
  selection, audition, inspect, pin/compare, and relevant generation actions.
- Chart summaries state axes, ranges, occupied/frontier counts, focus, and
  selected item. No meaning depends on spatial placement alone.
- Reduced motion behavior follows section 4.3 and is verified with the browser
  preference enabled.

## 24. Progressive-disclosure inventory

Always visible in the relevant context:

- destination/workflow, focused candidate, primary action and its consequence;
- play/pause, stop, bar/beat, loop, tempo summary, meter, exact length, master
  level, voice, beat mute;
- parent/anchor/pin/compare state and lock summary;
- tonic/scale summary, candidate duration/origin, favorite, and playing state;
- operation progress/cancel and blocking errors.

One disclosure, popover, Inspector tab, drawer, or sheet away:

- swing, subdivision, articulation, effects, beat family/density/fills;
- detailed locks, relationship rationale, borrowing, modulation, and custom
  scale visualization;
- crossover type, individual operator weights, directed-preset details;
- descriptor values, challenger/crowding data, migration/partner evidence;
- annotation and export scope.

Technical section only:

- raw seeds and labelled sub-seed paths;
- generator/evolution/descriptor schema versions;
- content hashes and deterministic IDs;
- genomes, normalized formulas/intermediate values;
- full repair/adaptation record and raw provenance JSON.

No technical section auto-opens after generation, error, focus change, or
import. An actionable error may deep-link to the specific technical row while
keeping a plain-language summary visible.

## 25. Required workflow walkthroughs

The real-browser test and manual QA must exercise these complete UI paths:

1. **Create:** fresh project → Legacy generation → play/stop/replay → Modern
   generation as branch → beat unmute/regenerate/previous/next/lock → voice and
   effects change without regeneration → direct remap → continuation → answer.
2. **MIDI:** select multitrack file → inspect tracks/polyphony/timing → choose
   explicit extraction/adaptation → cancel with unchanged project → repeat and
   confirm → use imported candidate in another workflow.
3. **Breed and Drift:** select one/two parents → incompatible adaptation preview
   → Breed with visible inheritance → three-way mutation → Drift bands →
   promote → return to old anchor and branch.
4. **Islands:** seed three policies → evolve one → Evolve all → inspect visible
   migration and pinned elite → cancel a later run without stale result.
5. **Map:** populate archive → keyboard cell audition → pin/challenger inspect →
   generate region → change axes and re-bin → perform equivalent actions in
   sortable list.
6. **Pareto:** configure 2–4 objective directions/targets/ranges → generate →
   keyboard chart navigation → inspect rank/crowding/frontier → change display
   axes without changing evolution → compare tray → use equivalent table.
7. **Pair Lab:** lock beat/evolve melodies → lock melody/evolve beats → freeze a
   beat layer → evolve both → swap/audition melody/beat/together → provide each
   of four feedback types → save components and pair separately.
8. **Audition/history/Library:** Blind A/B and reveal → continuous audition with
   favorite/parent/skip/stop → fork history → save/rename/annotate/search/filter
   in Library → seed each supported workflow.
9. **I/O:** project/candidate JSON round trip → malformed/future JSON error with
   unchanged state → melody MIDI → multitrack MIDI → melody WAV → combined WAV
   → cancel WAV → reload and restore exact destination/mode/history/selection.

## 26. Viewport and interaction verification matrix

Each required viewport must be visually inspected with representative dense
data, long names, advanced controls, open popover/drawer/sheet, error text, and
at least one running operation.

| Viewport | Required layout evidence |
| --- | --- |
| 1440×900 | Three-pane shell; all six wide workflow layouts; sticky regions do not cover focused content; piano roll and first candidates readable |
| 1280×720 | Three-pane where center minimum permits, otherwise Inspector drawer; compact-height transport/history; no clipped menus or primary actions |
| 1024×768 | Two-pane shell; right Inspector drawer; Controls collapsible; timeline at least 480 px while rail open; no crushed cards |
| 768 px tablet | Single central column; Controls/Inspector edge drawers; Islands tabs; chart/list switches usable; dialogs internally scroll |
| 390×844 mobile | One-column cards; compact sticky transport; Controls/Inspector bottom sheets; safe-area-aware history/triggers; no page horizontal overflow |
| 200% zoom | Natural tablet/mobile reflow; text and controls remain visible; no sticky overlap; only labelled data visualizations may scroll internally |

At every row verify keyboard-only navigation, visible focus, touch-size proxies,
reduced motion, colour-vision semantics, dynamic announcements, and console
errors/warnings. The artifact manifest contains at least one screenshot for
each primary destination (Create, Evolve, Explore, Library) and each mode
(Breed, Drift, Islands, Map grid/list, Pareto chart/table, Pair Lab), with
representative wide and narrow layouts.

## 27. UI acceptance criteria

The V2 UI is accepted only when:

1. Create, Evolve, Explore, and Library are always identifiable and preserve
   their state, focus, transport, and six mode states across navigation/reload.
2. Desktop uses the specified shell; narrower desktop uses an Inspector drawer;
   tablet avoids narrow permanent rails; mobile uses one column and labelled
   Controls/Inspector bottom sheets.
3. There is one sticky shared transport; card, tournament, audition, timeline,
   beat, MIDI, and WAV controls all reflect that authority and no stale Playing
   state remains after stop/switch/error.
4. Common controls and primary consequences are immediately visible while every
   listed advanced/technical concern follows the disclosure inventory. Raw JSON
   never dominates cards.
5. Warm charcoal/cream/amber identity remains recognizable, teal means active
   playback, red is limited to stop/error/destructive, and every provenance,
   selection, elite, favorite, borrowed, repair, and playing state has redundant
   text/icon/pattern semantics.
6. The focused piano roll and miniature rolls render exact onset, duration,
   rests, meter/grouping grid, partial bars, playhead, tonal regions, borrowing,
   A/B inheritance, mutation, elite, remap, repair, and optional drum lanes.
7. Child/overlay/side-by-side/difference inheritance views and exact event
   details are correct, keyboard reachable, and fully usable without hover.
8. Breed, Drift, Islands, Map, Pareto, and Pair Lab use their specified distinct
   layouts, selection language, state, progress, and primary actions at wide
   and narrow widths.
9. Map Grid/List and Pareto Chart/Table expose equivalent audition, focus,
   inspect, pin/compare, data, and relevant generation actions. Charts do not
   call descriptors/frontiers quality or best.
10. Blind A/B hides origin until a deliberate A/B/Neither/Both decision;
    continuous audition visibly advances and supports favorite, parent/anchor,
    skip, previous, stop, and resume without leaving the flow.
11. MIDI/JSON import and transport adaptation never mutate on file selection;
    previews expose all conversions; destructive change requires confirmation;
    every invalid/unsupported path retains current state and gives a specific
    remedy.
12. Export scope and track/render details are explicit; progress and cancellation
    work; cancelled/stale tasks commit and download nothing.
13. Empty, no-parent, incompatible-parent, loading, working, cancelled,
    impossible-constraint, audio, storage, invalid-import, and export-error
    states use the specified inline behavior and never depend on console output.
14. All creative shortcuts work with visible equivalents and are ignored while
    typing. Focus is not lost through re-bin, regeneration, drawer/sheet use,
    branch navigation, or responsive reflow.
15. WCAG 2.2 AA contrast, visible unobscured focus, semantic labels/landmarks,
    44×44 px targets, live-region behavior, chart/table alternatives, 200% zoom,
    reduced motion, and colour-vision-independent semantics pass automated and
    manual checks.
16. Required viewports show no clipped popovers, horizontal page overflow,
    crushed columns, unstable card heights, hidden actions, layout shifts,
    sticky overlap, or console errors/warnings.
17. Every control described here is connected to the real domain action and
    persistence. There are no placeholders, disconnected prototypes, disabled
    “coming soon” affordances, or mock chart populations.
