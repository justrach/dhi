# ADR 0005: Migration and Deprecation Policy

- Status: Accepted
- Date: 2025-08-28

## Context
We offer a temporary Zod-compat layer to ease adoption, but the native API is the long-term direction.

## Decision
- Treat the Zod-compat layer as temporary and document supported scope and gaps (see ADR 0001).
- Recommend a phased migration: import swap → selective native adoption → full native.
- Announce deprecations one minor version ahead with a clear changelog section and code mods where feasible.

## Versioning
- Follow semver. Removing the compat layer is a major release.
- Breaking behavioral changes in native APIs also require a major.

## Communication
- Maintain `MIGRATION.md` with concrete examples (API, forms, server validation).
- Provide migration-focused examples under `migrations/`.

## Consequences
- Users get predictability and time to migrate.
- Maintainers avoid indefinite support burden for the compat layer.

## References
- Docs: `MIGRATION.md`
- Examples: `migrations/`
