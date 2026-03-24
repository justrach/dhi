## Rach's Agentic Contribution Template

Maintainer process template by [@rachpradhan](https://x.com/rachpradhan).

## Linked Issue

Closes #

If this PR is not tied to an existing issue, open one first.

## Summary

- what changed
- why it changed
- what is intentionally not in scope

## Scope

- subsystems touched:
- generated files changed: yes/no
- lockfile changed: yes/no
- benchmark/docs-only/runtime change:
- changed lines count:

## Rebase Status

- [ ] Rebasing onto current `main` completed before requesting review

## Tests Run

```bash
# paste exact commands here
```

## Red-To-Green Evidence

### Failing Before

```bash
# paste the exact failing test or repro command here
```

### Passing After

```bash
# paste the exact passing rerun here
```

### Nearby Non-Regression Checks

```bash
# paste the closest neighboring tests / guards you ran here
```

## Benchmarks

If this PR changes benchmark code or benchmark claims, fill this out:

- layer measured:
- caches disabled or enabled:
- warmup policy:
- number of runs:
- local or CI:
- environment:

## Checklist

- [ ] PR is matched to an issue
- [ ] PR scope is narrow and reviewable
- [ ] PR is under 500 changed lines, or I justified why it cannot be split
- [ ] I showed the failing test or repro before the fix
- [ ] I showed the same test or repro passing after the fix
- [ ] I ran nearby non-regression checks, not just the one happy-path test
- [ ] No generated `.zig-cache`, `zig-out`, dylibs, or other build artifacts are committed
- [ ] No unrelated dependency or lockfile churn is included
