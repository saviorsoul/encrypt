# FRIENDSHIPS-MUTE-3 — Re-share delivery respects original author message mute

**As** a registered user who muted another friend's **messages**  
**I want** re-shares of their content to be blocked for me too  
**So that** I do not receive their posts indirectly through someone else's network.

## Acceptance criteria

### Scenario

- Alice authored a message.
- Bob (my friend) re-shares Alice's message to his network, including me.
- I muted **Alice's messages** (not necessarily Bob's shares).

### Write-time enforcement

- On `POST /shares`, the server resolves the **original author** of the parent message.
- For re-shares (sharer ≠ author), delivery is blocked for any recipient who muted the **author's messages**, even if that recipient has not muted the sharer's shares.
- For re-shares, delivery is also blocked for recipients who muted the **sharer's shares** (FRIENDSHIPS-MUTE-2).
- A recipient is omitted if **either** mute applies.
- When the sharer is the original author, only the **messages** mute scope is checked (no separate author query; see FRIENDSHIPS-MUTE-1).

### Data access

- Author message-mute constraints for all candidate recipients are loaded in **one** database query (`listRecipientsWhoMutedAuthorMessages`).
- Sharer friendship and mute constraints continue to use the existing combined friendship query (`listDeliveryFriendshipConstraints`).

## Related

- FRIENDSHIPS-MUTE-1 — Mute new messages from a friend
- FRIENDSHIPS-MUTE-2 — Mute new shares from a friend
- API: `apps/api/src/contexts/feed/application/shares/resolveParentMessageAuthorKeyId.ts`, `apps/api/src/contexts/feed/application/shares/resolveDeliverableShareKeyManifest.ts`
- API tests: `apps/api/src/tests/resolveDeliverableShareKeyManifest.test.ts`, `apps/api/src/tests/listDeliveryFriendshipConstraints.test.ts`
