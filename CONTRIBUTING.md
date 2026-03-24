# Rach's Agentic Contribution Template

Maintainer process template by [@rachpradhan](https://x.com/rachpradhan).

This repo moves quickly. Small, current, issue-linked PRs are much easier to review and much less likely to regress behavior.

## Ground Rules

1. Every PR must be tied to an issue.
2. Rebase onto current `main` before requesting final review.
3. Keep PRs tightly scoped.
4. Do not commit generated artifacts.
5. Do not mix unrelated lockfile churn, scaffolding, or benchmark churn into a focused fix.
6. Keep each PR under **500 changed lines** by default.

If a branch goes stale, close it and open a smaller replacement instead of piling more changes onto the old PR.

## PR Requirements

Every PR description should include:

- linked issue number
- summary of the exact change
- files or subsystems touched
- tests run
- failing test, xfail, or exact repro that demonstrated the problem before the fix
- passing rerun of that same test or repro after the fix
- nearby non-regression checks proving the change did not just move the bug
- whether the branch was rebased onto current `main`
- whether any generated files, lockfiles, or benchmarks changed

If a PR does not map cleanly to an issue, open the issue first.

## Red-To-Green Rule

For bug fixes, compatibility fixes, runtime fixes, and perf regressions:

1. show the failing test, xfail, or exact repro first
2. make the code change
3. rerun the same test or repro and show it passing
4. run the closest neighboring tests to prove the fix did not just move the bug

If there is no failing test yet, write one first unless the failure is impossible to encode cleanly.

## Scope Rules

Good PR scope:

- one bug fix
- one benchmark methodology fix
- one small perf change
- one docs-only clarification

Bad PR scope:

- runtime change + unrelated refactor
- perf tweak + dependency upgrade
- feature work + generated build output
- benchmark change + docs rewrite + lockfile churn

If a reviewer cannot explain the PR in one sentence, it is probably too large.

## Rebase Policy

Before requesting review on any non-trivial PR:

```bash
git fetch origin
git rebase origin/main
```

If rebasing reveals unrelated conflicts, split the PR.

## Generated Files

Do not commit generated or local-build artifacts, including:

- `.zig-cache/`
- `zig-out/`
- `.dylib`, `.so`, `.o`
- local benchmark artifacts/logs unless the PR is explicitly about publishing benchmark evidence

If a file is generated during local builds, add or update `.gitignore` instead of committing it.

## Lockfiles And Dependencies

Do not update lockfiles unless the PR actually changes dependencies.

If you touch dependency metadata:

- explain why
- keep that change isolated
- mention it clearly in the PR summary

## Tests

Run the narrowest relevant tests for the code you changed.

For fixes, do not just say “tests passed”.

Show:

- the failing command before the fix
- the passing command after the fix
- at least one neighboring or regression-guard command

## Benchmark PRs

Benchmark-related PRs must say:

- what layer is being measured
- whether caches are on or off
- whether numbers are cold-start or warmed steady-state
- number of runs
- whether values are single-run or median
- exact machine or CI environment

Do not publish cached results as uncached performance.

## Review Expectations

Reviewers will push back on:

- stale branches
- unrelated file churn
- generated artifacts
- oversized PRs
- missing issue links
- claims that do not match the changed code

That is process, not hostility.

The easiest way to get a fast review is:

1. open an issue
2. make a small branch
3. rebase onto `main`
4. keep the diff narrow
5. include exact tests and rationale
