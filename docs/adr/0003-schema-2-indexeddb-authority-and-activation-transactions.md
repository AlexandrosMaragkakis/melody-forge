# ADR 0003: Schema-2 IndexedDB authority and activation transactions

- Status: accepted
- Date: 2026-08-09

## Context

V1 stores one schema-1 project envelope in localStorage. That representation is
small and synchronous, but it cannot safely own V2's normalized projects,
candidate/component tables, six workflow populations, branch history, Library,
undo state, migration receipts, or atomic revision checks. Silent fallback from
a failed large write would also create two competing authorities and make
reload behavior depend on browser quota.

V2 must preserve the untouched V1 key as recovery input, migrate deterministically,
strict-read its own writes before activation, survive crashes between staging
and activation, and reject stale tabs/workers. Project creation, opening, normal
save, import replacement, and V1 activation have different mutation semantics
and cannot be hidden behind one ambiguous write call.

## Decision

### Durable authorities

Schema-2 domain state uses IndexedDB database `melody-forge-v2`, database
version `1`. The database version is independent from project schema version.
Object stores, in creation order, are:

1. `projects`
2. `createStates`
3. `modeStates`
4. `historyGraphs`
5. `historyNodes`
6. `snapshots`
7. `melodyCandidates`
8. `melodyGenomes`
9. `transports`
10. `v1TimingProfiles`
11. `tonalTimelines`
12. `customScales`
13. `beats`
14. `performanceSettings`
15. `pairings`
16. `preferenceRecords`
17. `libraryItems`
18. `ratings`
19. `annotations`
20. `undoStates`
21. `migrationReceipts`
22. `appMetadata`

Every store has embedded key path `id`. `migrationReceipts` alone has a unique
`sourceHash` index. Browser IDB request/event types stay inside the adapter.
The adapter exposes promises and typed results/errors to application code.

The existing `melody-forge:project:v1` localStorage value is read-only
migration/recovery input and is never cleared or rewritten by schema 2. The
only V2 localStorage authority is presentation-only
`melody-forge:ui-preferences:v2`; IndexedDB failure never redirects domain data
there.

### Registered schema boundary

Every durable row has an embedded stable ID and independent data version.
Before a row can be stored, its exact-key versioned codec and reference
validator must be registered. Unknown future payloads reject; the adapter never
round-trips opaque JSON. The M2 kernel registers only the Project root,
algorithm registry, migrated-V1 candidate/genome/timing subset, LockSet,
Create/Breed-or-empty mode state, migrated-V1 snapshot/history, Library,
rating/annotation, undo, performance, pairing, receipt, and active metadata
records frozen by Product and Architecture. Later milestones extend the
registry before writing their states.

### Revisions and normal save

`StoredProjectRecordV2.revision` is a positive safe integer outside creative
identity. A normal save validates a self-contained graph, checks the exact
stored `expectedRevision`, and writes changed rows plus revision `+1` in one
read-write transaction.

When saving the currently active project, the same transaction also
compare-and-swaps `appMetadata/active-project` at the same project ID/revision
and advances it to revision `+1`. Saving an inactive project leaves active
metadata untouched. Any record/metadata mismatch is stale; the transaction
aborts entirely.

### Native install, opening, and confirmed replacement

`installAndActivateProject` receives the complete graph,
`expectedStoredRevision: number | null`, complete
`expectedPriorActive: ActiveProjectMetadataV2 | null`, and reason
`native-create | confirmed-schema2-replace`.

- Null target expectation requires target absence and graph revision `1`.
- A numeric target expectation requires that exact stored revision and a graph
  record one revision greater.
- Native creation permits only the absent/revision-1 case.
- Replacement is unavailable until strict import preview and explicit user
  confirmation.

One transaction checks both expectations, validates and writes the full graph,
removes obsolete target-project-owned rows not reachable from the replacement,
retains global Library rows, strict-reads the just-written graph, and only then
writes exact active metadata. Any failure rolls back all graph and metadata
changes.

`activateProject` opens an existing inactive graph. It receives project ID,
expected target revision, and expected prior active metadata. In one
transaction it checks/strict-loads the complete target, compare-and-swaps prior
active metadata, and changes only the active metadata row. It never rewrites
the project merely by opening it.

### V1 two-phase activation

Only complete localStorage/project-envelope migration creates a project receipt
and can activate a project. Candidate-envelope conversion remains an in-memory
preview until explicit Save to Library or Seed into the current project.

Complete-project migration is two-phase:

1. Pure conversion and equivalence validation occur in memory.
2. Transaction one writes the complete revision-1 graph, exact
   `pending-readback` receipt, and applicable raw source evidence without
   changing active metadata.
3. The normal strict loader reads the inactive stage outside the transaction
   and repeats graph validation and full V1/V2 equivalence.
4. Transaction two compare-and-swaps the expected prior active metadata and
   staged project revision, changes only receipt status to `verified`, and
   installs active metadata.

A crash after staging leaves an inactive pending graph. Retry by the unique
source hash reuses and revalidates that stage; it never exposes partial data or
derives new identities.

### Failure model

The adapter distinguishes blocked/unavailable database, quota, abort,
conflict/stale revision, immutable collision, not found, decode, read-back, and
upgrade failures. Failures preserve the last committed active revision and the
caller's in-memory work. Recovery may offer retry, project export, and explicit
Library cleanup. It never clears the V1 source, silently drops rows, or falls
back to another domain store.

### Test adapter

The production adapter uses native IndexedDB without a runtime dependency.
Unit tests may use `fake-indexeddb` as a development-only implementation to
exercise upgrade, atomic rollback, quota/error injection seams, CAS conflicts,
crash-resume, and multi-store transactions quickly. Real Chromium tests remain
the authority for browser integration and blocked/versionchange behavior.

## Checkpoint implementation state

At the 2026-08-09 safe checkpoint, the decision is implemented through the M2
registered boundary on local branch `v2`: the native 22-store schema, typed
errors, registered graph loader, create/open/replace/save CAS, two-phase
stage/verify activation, crash retry, obsolete project-owned-row cleanup, and
global Library merge/preservation are present under `src/persistence/v2/`.
`fake-indexeddb` is a development-only dependency and the focused authority
tests pass.

The decision is not yet installed as the application's bootstrap authority.
The current UI still runs the valid V1 reducer/localStorage path; automatic V1
migration, active-project restore, recovery presentation, candidate Save/Seed,
and real-Chromium IndexedDB evidence remain incomplete. Later stores are
reserved but their payloads remain rejected until registered by their owning
milestones. The next task on explicit resume is the single M2 bootstrap
coordinator defined in `docs/V2_ARCHITECTURE.md`; M3 is not authorized before
that integration boundary.

This ADR is checkpointed by the commit containing this note on
`refs/heads/v2`; the exact resolved SHA is recorded in the handoff report. Its
starting integration HEAD is `721f006a48c55ec1a6155d87d023feb89d13f2af`.

## Consequences

- Domain/application code has one asynchronous repository boundary and no IDB
  event/request coupling.
- Project activation is explicit and testable; selecting a file or inactive
  project cannot silently replace current work.
- More stores and strict closure validation add implementation work, but make
  partial writes, stale overwrites, and split-brain persistence observable and
  rejectable.
- Global Library ownership must be handled deliberately during project replace
  and deletion.
- New mode/entity schemas cannot persist until their codecs are registered,
  preventing supposedly forward-compatible but semantically unreadable state.

## Rejected alternatives

- **Keep schema 2 in localStorage:** rejected for capacity, atomicity, and
  normalized multi-store requirements.
- **Use localStorage as quota fallback:** rejected because it creates competing
  authorities and silent data loss.
- **Activate in the staging transaction:** rejected because persisted bytes
  would not pass the normal loader/equivalence gate before becoming active.
- **One generic `save`/`transact` command:** rejected because creation, active
  save, inactive save, open, replace, and migration activation require distinct
  preconditions and effects.
- **Preserve unknown payload JSON:** rejected because byte preservation is not
  semantic validation or safe restoration.
- **Add an IndexedDB runtime wrapper library:** deferred; the native API is
  sufficient behind the owned adapter, while `fake-indexeddb` is test-only.
