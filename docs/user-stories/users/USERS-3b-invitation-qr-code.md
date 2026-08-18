# USERS-3b — Invitation QR code

**As** a friend on the network  
**I want** to share or scan an invitation as a QR code  
**So that** I can invite or join without typing a long UUID.

## Acceptance criteria

### Showing a QR code (inviter)

- After creating an invitation, inviter can open **Show QR code** from **Invite friend** or from a pending invitation on Users.
- QR encodes the **invitation ID (UUID) only** — not a URL or app link.
- Dialog shows the same UUID as text for manual copy.

### Scanning a QR code (invitee — Feednt)

- On Users, **Accept invite** opens a dialog with **Invitation ID** (default) and **QR code** tabs.
- **QR code** tab → **Scan QR code** opens the camera scanner (native on mobile Capacitor, web camera in browser).
- Scanner accepts only a valid invitation UUID from the QR payload; invalid codes show an error and do not navigate away.
- On success, app navigates to the in-app invitation accept page (`/invite/:token`) for the scanned ID.
- Invitee completes accept with their key (same API as USERS-3).

### Feed Lab

- Inviter can **Show QR code** when sharing an invitation (same UUID-only encoding).
- **Accept invite** dialog includes a **QR code** tab with an info message that scanning is **not available in Feed Lab yet**; invitee uses the **Invitation ID** tab or `/invite/:token` in the browser.

## Related

- UI: `InvitationQrCodeDialog`, `AcceptInvitationDialog`, `FeedntInvitationQrScan`
- Feednt native scan: `apps/feednt/src/lib/scanInvitationQrCode.ts`
- UUID parsing: `packages/core/src/invite/invitationLink.ts` (`parseScannedInvitationUuid`)
- Invitation accept flow: `docs/user-stories/users/USERS-3-get-invited-via-id.md`
