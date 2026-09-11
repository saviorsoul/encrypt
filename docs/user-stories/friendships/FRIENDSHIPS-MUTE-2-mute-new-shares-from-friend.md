# FRIENDSHIPS-MUTE-2 — Mute new shares from a friend

**As** a registered user  
**I want** to mute new shares from a specific friend  
**So that** they cannot forward other people's content to me while we stay friends.

## Acceptance criteria

### Mute control

- `GET /friendships` includes `sharesMuted` per friend.
- `POST /friendships/mute` with `{ friendKeyId, scope: "shares" }` sets `sharesMuted` on my friendship row.
- `DELETE /friendships/mute` with the same body clears `sharesMuted`.

### Write-time enforcement

- On `POST /shares`, when the sharer is **not** the original author of the parent message (a re-share), recipients who muted the **sharer** for **shares** are omitted from the delivered key manifest.
- Sharing my **own** authored message (single share or message-history batch) uses the **messages** mute scope instead, so I can still sync my history to a friend who blocked my re-shares but accepts my direct posts (see FRIENDSHIPS-MUTE-1).
- Mute applies only to **new** delivery. Existing manifest shards and inbox rows are never removed or changed.

### UI

- Identity dialog shows a shares mute toggle for established friends.
- Feed message cards show a mute indicator on the **shared by** line when that friend has any active mute scope; tooltip text reflects the exact muted scope(s).

## Related

- FRIENDSHIPS-MUTE-1 — Mute new messages from a friend
- FRIENDSHIPS-MUTE-3 — Re-share delivery respects original author message mute
- API: `apps/api/src/contexts/feed/application/shares/resolveShareDeliveryMuteScope.ts`, `apps/api/src/contexts/feed/application/shares/resolveDeliverableShareKeyManifest.ts`, `apps/api/src/contexts/feed/application/shares/commands/createShare/createShare.handler.ts`
- API tests: `apps/api/src/tests/resolveShareDeliveryMuteScope.test.ts`, `apps/api/src/tests/resolveDeliverableShareKeyManifest.test.ts`
