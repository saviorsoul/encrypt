# 0001. Use Architecture Decision Records

- **Status:** Accepted
- **Date:** 2026-06-17

## Context

The Encrypt app makes non-trivial choices around cryptography, local storage, and private-key handling. Those choices are easy to lose in chat history or pull-request threads. New contributors need a durable, searchable record of **why** the codebase looks the way it does.

## Decision

We maintain Architecture Decision Records (ADRs) under `docs/adr/`.

- Each ADR is one markdown file, numbered sequentially.
- Accepted ADRs are not rewritten in place; superseding decisions get a new ADR.
- Security- and crypto-related decisions must be documented here when they affect runtime behaviour.

### Updating a past ADR without rewriting it

When a later decision **refines** an accepted ADR but does not fully supersede it:

1. Add a **new ADR** with the full context and decision for the change.
2. In the **older ADR**, append a **`## Changes`** section (create it if missing). Add a dated subsection that links to the new ADR and records what shifted — typically as a table: *as accepted* vs *current*.
3. Leave the original **Context**, **Decision**, and **Consequences** text as it was when accepted. Touch it only when a reader would otherwise be misled by a fact that cannot live in **Changes** (keep such edits as small as possible).

When a decision is **fully replaced**, mark the old ADR **Superseded by [NNNN](./NNNN-….md)** and still prefer a new ADR over editing the old body.

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
