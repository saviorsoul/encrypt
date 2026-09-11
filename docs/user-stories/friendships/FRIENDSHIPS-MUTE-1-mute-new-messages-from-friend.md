# FRIENDSHIPS-MUTE-1 — Mute new messages from a friend

**As** a registered user  
**I want** to mute new messages from a specific friend  
**So that** they cannot deliver new posts to me while we stay friends.

## Acceptance criteria

### Mute control

- `GET /friendships` includes `messagesMuted` per friend.
- `POST /friendships/mute` with `{ friendKeyId, scope: "messages" }` sets `messagesMuted` on my friendship row.
- `DELETE /friendships/mute` with the same body clears `messagesMuted`.
- Mute scopes are independent: muting messages does not mute shares, and vice versa.

### Write-time enforcement

- On `POST /messages`, recipients who muted the sender for **messages** are omitted from the delivered key manifest.
- On `POST /shares`, when the sharer is the **original author** of the parent message (including bulk message-history sync), recipients who muted the sharer for **messages** are omitted.
- Mute applies only to **new** delivery. Existing manifest shards and inbox rows are never removed or changed.

### UI

- Identity dialog shows a messages mute toggle for established friends.
- Feed message cards show a mute indicator next to a friend's name when `messagesMuted` or `sharesMuted` is active; the tooltip states exactly which scope(s) are muted (messages only, shares only, or both).
- Friendship data (including mute flags) loads automatically after sign-in without requiring a manual refresh.

## Related

- FRIENDSHIPS-MUTE-2 — Mute new shares from a friend
- FRIENDSHIPS-MUTE-3 — Re-share delivery respects original author message mute
- API: `apps/api/src/contexts/feed/application/messages/resolveDeliverableKeyManifest.ts`, `apps/api/src/contexts/feed/application/messages/commands/createMessage/createMessage.handler.ts`
- API tests: `apps/api/src/tests/filterKeyManifestToFriends.test.ts`, `apps/api/src/tests/resolveDeliverableKeyManifest.test.ts`, `apps/api/src/tests/listDeliveryFriendshipConstraints.test.ts`
