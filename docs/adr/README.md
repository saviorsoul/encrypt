# Architecture Decision Records (ADR)

This folder documents significant architectural and security decisions for the Encrypt app.

An ADR captures **why** a decision was made, not only **what** was implemented. Records are immutable once accepted: if a decision changes, add a new ADR that supersedes the old one.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-use-architecture-decision-records.md) | Use Architecture Decision Records | Accepted |
| [0002](./0002-in-memory-non-extractable-private-key-cache.md) | In-memory non-extractable private key cache | Accepted |
| [0003](./0003-ephemeral-sender-ecdhe-for-key-manifest-shards.md) | Ephemeral sender ECDHE for key-manifest shards | Accepted |
| [0004](./0004-main-process-owns-external-file-reads.md) | Main process owns external file reads (no path-based IPC from renderer) | Accepted |
| [0005](./0005-feed-share-and-comments-parent-dek-model.md) | Feed share and comments: `parentMessageId`, shared DEK, and delivery isolation | Accepted |
| [0006](./0006-known-dek-does-not-recover-recipient-private-key.md) | Known DEK and message material do not recover a recipient’s private key | Accepted |

## When to write an ADR

Write an ADR when a decision:

- affects security, privacy, or key handling
- is hard to reverse or expensive to change later
- has meaningful trade-offs that future contributors should understand
- was debated or rejected alternatives deserve a paper trail

Skip ADRs for routine refactors, dependency bumps, or obvious bug fixes.

## File naming

```
docs/adr/NNNN-short-title-in-kebab-case.md
```

- `NNNN` — four-digit sequence (`0001`, `0002`, …)
- `short-title-in-kebab-case` — a few words describing the topic

## Status values

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion; not yet implemented |
| **Accepted** | Decision is in effect |
| **Deprecated** | No longer recommended; replacement ADR should exist |
| **Superseded by [NNNN](./NNNN-….md)** | Replaced by a newer ADR |

## Template

Copy this when adding a new ADR:

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN](./NNNN-….md)
- **Date:** YYYY-MM-DD
- **Authors:** (optional)

## Context

What problem or constraint led to this decision?

## Decision

What we chose to do.

## Consequences

### Positive

- …

### Negative / limitations

- …

## Alternatives considered

### Option A

- …

### Option B

- …

## References

- Code: `src/…`
- Related ADRs: …
```

## Process

1. Copy the template into `docs/adr/NNNN-your-title.md`.
2. Set status to **Proposed** while reviewing.
3. After implementation (or explicit agreement), set status to **Accepted** and add a row to the index table above.
4. To change a past decision, add a new ADR and mark the old one **Superseded by NNNN**.
