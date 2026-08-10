# Repository instructions

## Read before changing anything

- Treat `PROJECT_STATUS.md` as the authoritative record of current progress and the next permitted work.
- For V2 work, read `docs/V2_IMPLEMENTATION_PLAN.md`, `docs/V2_ARCHITECTURE.md`, and the directly relevant requirements, ADRs, and source files.
- Follow `docs/DEVELOPMENT_WORKFLOW.md` for branch roles, verification, merging, and deployment.

## Scope and preservation

- Implement one coherent, roadmap-valid change per branch and pull request.
- Do not expand into later milestones, unrelated cleanup, speculative abstractions, or additional features.
- Never modify anything under `legacy/`. Preserve the baseline recorded in `docs/LEGACY_SHA256.txt`.
- Do not add placeholders, disconnected scaffolds, mock implementations presented as product behavior, or hidden “coming soon” functionality.
- Keep the repository runnable after every completed work unit.
- Update `PROJECT_STATUS.md` and traceability documents when implementation status or evidence changes. Do not claim completion without evidence.

## Branch and GitHub workflow

- Never implement directly on `main` or `v2`.
- V2 work starts from the latest `origin/v2` on a clean worktree and uses a bounded `feature/v2-*` branch.
- Stop and report before editing if the worktree is dirty, the expected base differs, or unrelated changes are present.
- Target V2 pull requests at `v2`, never `main`.
- Only work against `main` for an explicitly requested release or hotfix task.
- When the task prompt requests publication, commit intentionally, push the feature branch, and open a draft pull request. Link the supplied issue.
- Never mark a pull request ready, merge it, deploy, tag a release, force-push, delete branches, or modify protected refs without the user's explicit instruction.

## Implementation and testing

- Every behavioral change must have deterministic automated tests at the appropriate level.
- Prefer dependency injection for clocks, randomness, storage, audio, and other effects where reproducibility matters.
- Preserve existing behavior unless the accepted task explicitly changes it.
- For UI or observable browser behavior, add or update Playwright coverage when practical.
- Automated tests are required even when the user will also perform manual acceptance.

Before publishing an implementation pull request, run:

```bash
npm ci
npm run check
npm run test:e2e
npm run build:pages
git diff --check
```

Also run focused tests and any applicable persistence, legacy-preservation, traceability, accessibility, audio, export, Docker, or asset-path checks. Review the complete diff against `origin/v2` and fix substantiated issues without expanding scope.

For documentation-only changes, run the applicable lightweight checks and `git diff --check`; do not run unrelated expensive suites unless the documentation changes commands, workflows, generated status, or executable configuration.

## Handoff and acceptance

- Open pull requests as drafts and leave them unmerged.
- Report the branch, commit SHA, pull-request URL, changed files, exact verification results, remaining risks, and whether observable behavior changed.
- If the change is interactive, start the application and give the user a short concrete manual acceptance checklist and local URL.
- Wait for the user's manual result when applicable and always wait for explicit merge approval.
