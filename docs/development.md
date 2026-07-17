# Development Workflow

## Branches and commits

- Branches use `agent/<description>` for AI-led work and short descriptive names for manual work.
- Commits are imperative and scoped to one reviewable concern where practical.
- Do not commit `.env`, credentials, generated build output, local logs, or database dumps.
- Keep a clean worktree before beginning the next sprint.

## Migrations

- Prisma migrations use the generated timestamp prefix and a descriptive suffix.
- Never edit an applied migration. Add a forward migration instead.
- Validate the complete migration history against an empty disposable PostgreSQL database.
- Production-style environments use `pnpm db:deploy`; `pnpm db:migrate` is for local migration development.

## Architecture decisions

- ADR files use `ADR-NNN-short-title.md` and are immutable once superseded except for status and supersession links.
- Update ADRs when a change alters package boundaries, persistence policy, execution safety, precision, or time semantics.

## Quality commands

- `pnpm check`: formatting, documentation links, lint, types, unit tests, and production builds without requiring PostgreSQL.
- `pnpm test:integration`: database integration tests using the configured test `DATABASE_URL`.
- `pnpm check:ci`: migrations, the complete base check, database integration tests, and migration status.

Integration tests must use a dedicated disposable database. Never point test commands at a production database.
