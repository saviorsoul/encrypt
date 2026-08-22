export type GdprDataSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const GDPR_DATA_PAGE_TITLE = 'Personal data in this app';

export const GDPR_DATA_PAGE_INTRO =
  'This notice describes what personal data this app stores and processes when you use the Feed API companion apps (Feednt / Feed Lab).';

export const GDPR_DATA_PAGE_NOTICE =
  'This page describes the rules for open tests (beta version) of the application. All data will be removed on 06.09.26 (DD.MM.YY).';

export const GDPR_DATA_SECTIONS: GdprDataSection[] = [
  {
    id: 'summary',
    title: 'Summary',
    paragraphs: [
      'The app does not ask for email, phone number, legal name, or password. You are identified by a cryptographic keyId (a thumbprint of your public key) and your EC P-256 public key.',
      'Messages are end-to-end encrypted. The server stores ciphertext and cannot read message content. Encrypted data is still personal data under GDPR when it relates to you.',
    ],
  },
  {
    id: 'on-device',
    title: 'Data on your device',
    paragraphs: [
      'The following stays in your browser or app storage until you clear it or refresh the page (memory stored data):',
    ],
    bullets: [
      'keyId and public key (your cryptographic identity)',
      'Private key from secure device storage (Feednt) or a key file you import (Feed Lab) - both stored in memory',
      'Encrypted messages, shares, comments, and key-manifest shards - stored in memory',
      'Local username you choose to label your friends',
      'Friend invitation labels you create when sending invites',
      'App settings (for example dark mode and decryption preferences)',
    ],
  },
  {
    id: 'on-server',
    title: 'Data on the Feed API server',
    paragraphs: ['When you connect to the Feed API, the operator stores:'],
    bullets: [
      'keyId, public key, and account status (active or inactive) in the users table',
      'Encrypted message, share, and comment payloads (ciphertext JSON)',
      'Key-manifest shards (which keyIds can decrypt each message)',
      'Friendship graph and friendship requests',
      'Friend invitations (token, inviter/invitee keyId - kept after you clear your account, see retention)',
      'Account creation timestamp',
      'Request auth nonces (TTL 15 minutes)',
    ],
  },
  {
    id: 'not-collected',
    title: 'What we do not collect',
    paragraphs: ['By design, the application code does not store:'],
    bullets: [
      'Email address, phone number, or legal name',
      'Passwords or password hashes',
      'IP addresses in application logs',
      'Cookies or third-party analytics',
      'Profile photos or avatars',
    ],
  },
  {
    id: 'why-invite',
    title: 'Why this matters when you accept an invite',
    paragraphs: [
      'Accepting an invitation registers your keyId and public key on the server (if not already present), creates a friendship with the inviter, and may store encrypted feed data tied to your identity.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your rights and retention',
    paragraphs: [
      'You can clear your account from Settings → Clear account data while signed in. That is a self-service erasure request (GDPR Art. 17) for friendships, friendship requests, your decryption shards, and ciphertext that nobody else can still decrypt. Your users row is kept with status inactive (keyId and public key remain) so the same key cannot register a new account. It also removes local friend labels for this account and signs you out.',
      'Friend invitation records are not deleted when you clear your account. The Feed API is invite-only: those rows are how the operator knows who was invited into the app (invitation token, inviter keyId, invitee keyId, status, and timestamps). They do not include message content.',
      'Friends keep their own copies of messages. Encrypted payloads on threads others still hold will remain, those copies also relate to the remaining recipients. During this open test (beta), all server-held test data — including retained invitations — will be removed on 06.09.26.',
      'For any concerns around data retency mechanisms contact support@feednt.com',
    ],
  },
];
