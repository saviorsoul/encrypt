# 0001. Use Architecture Decision Records

- **Status:** Accepted
- **Date:** 2026-06-17

## Context

The Encrypt app makes non-trivial choices around cryptography, local storage, and private-key handling. Those choices are easy to lose in chat history or pull-request threads. New contributors need a durable, searchable record of **why** the codebase looks the way it does.

## Decision

We maintain Architecture Decision Records (ADRs) under `docs/adr/`.

- Each ADR is one markdown file, numbered sequentially.
- Accepted ADRs are not rewritten; superseding decisions get a new ADR.
- Security- and crypto-related decisions must be documented here when they affect runtime behaviour.

See [README.md](./README.md) for naming, status values, and the document template.

## Consequences

### Positive

- Decisions and rejected alternatives remain discoverable alongside the code.
- Security trade-offs are explicit instead of implied by implementation details.

### Negative / limitations

- ADRs require maintenance when the index or status changes.
- Documentation can drift from code if ADRs are not updated when superseded.

## References

- [README.md](./README.md) — ADR process and template
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
