# Development workflow

## Branch roles

`main` is the stable, deployable V1 line. V1 `v1.0.0` is deployed from `main`,
and changes merged there must be release-ready because a successful push to
`main` is the only automatic GitHub Pages deployment source.

`v2` is the long-lived integration branch for unfinished V2 work. Create bounded
branches named `feature/v2-*` from `v2`, keep each branch focused on one coherent
change, and merge it back into `v2` after review and CI. Do not merge unfinished
V2 work into `main`.

Create release branches and urgent hotfix branches from `main`, then merge them
back into `main` through a pull request. Bring applicable hotfixes forward to
`v2` separately so the integration line does not lose them.

Branches should represent coherent product or engineering milestones. They must
not be created merely to mark a Codex session, context window, usage period, or
other tooling boundary.

## Verification and merging

Pull requests into `main` or `v2` must pass CI before merging. CI performs a
locked clean install followed by:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Run relevant additional checks when a change touches browser behavior, Docker,
accessibility, persistence, audio, or downloads. Keep unrelated changes out of
the pull request, identify its target branch explicitly, and update durable
documentation when behavior or operating procedures change.

## Deployment

GitHub Pages deployment is allowed only from `main`. Pull requests, `v2`,
`feature/v2-*`, and other feature branches verify but never deploy. A manual
deployment dispatch is also restricted by the workflow to the `main` ref.

Release/CI infrastructure may be aligned into `v2` through a focused integration
branch. This infrastructure-only alignment must not resume V2 implementation or
bring unfinished V2 work into `main`.

## Long-running Codex work

For work that spans multiple substantial steps, make checkpoint commits at
coherent, verified milestones and update `PROJECT_STATUS.md` (or the applicable
project-status document) with completed evidence, remaining work, and the next
action. A checkpoint should leave the branch understandable and recoverable; it
is not a record of a Codex session or token/usage boundary.
