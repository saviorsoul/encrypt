# USERS-8 — Delete personal data

**As** a registered user  
**I want** to clear my personal data from the Feed API and this device  
**So that** I can erase account-held records, and this key cannot create a new account.

## Acceptance criteria

- **Clear account data** is available in Settings → Personal data only while signed in with a registered (active) key.
- Confirming calls `DELETE /api/account` (auth + registration gate). Unregistered key → `400 Unknown user keyId`. Inactive key → `403 This account is inactive.`
- Server **deletes** friendship requests, established friendships, this recipient’s key-manifest shards, and ciphertext that nobody else can still decrypt.
- Server **keeps** `friend_invitations` (who was invited in) and the `users` row, with `status` set to `inactive`.
- The same key cannot register again (`403 This key cannot be used to create a new account.`).
- Local friend labels and sent-invitation labels for this keyId are cleared; the user is signed out.
- Distinct from [USERS-6](USERS-6-lose-friends-stay-registered.md): unfriending everyone leaves the user **active** and able to re-add friends; this story makes the key unusable as a new account.

## Related

- API: `apps/api/src/tests/eraseAccountData.test.ts`
- API: `apps/api/src/tests/clearAccount.test.ts`
- API: `apps/api/src/tests/inactiveUserRegister.test.ts`
- API: `apps/api/src/tests/registeredUserGate.test.ts`
- Notice: Settings → Personal data → Personal data notice (`packages/ui/src/content/gdprDataContent.ts`)
