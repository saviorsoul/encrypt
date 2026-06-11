import { bytesToBase64 } from '@/utils/bytes.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import {
  HKDF_INFO,
  HKDF_SALT_LENGTH,
  MANIFEST_VERSION,
  MANIFEST_WRAP,
} from '@/crypto/manifestConstants.ts';
import { signManifestBody } from '@/crypto/manifestSign.ts';
import type {
  KeyManifestMap,
  KeyManifestRecipientPayload,
  ManifestAssembly,
} from '@/types/manifest.ts';

/**
 * Recipient identity + public ECDH material for manifest KEK derivation (encrypt path).
 * Peer private keys never belong here — demo decrypt uses `MockExternalRecipientMaterial` (`mockExternalRecipient.ts`) instead.
 */
export interface ManifestRecipientKeys {
  /**
   * Map key in `keyManifest`. Prefer an RFC 7638 EC public JWK thumbprint
   * (`ecPublicJwkThumbprintSha256` in `jwkThumbprint.ts`) or a server-assigned id — not `x` alone.
   */
  keyId: string;
  publicKey: CryptoKey;
}

/** ECDHE agreement key pair scoped to one manifest (discard `.privateKey` after encrypt completes). */
export async function generateManifestEphemeralAgreementKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey'],
  );
}

/** Step 1 (ECDH): raw shared secret — same bits the HKDF step imports as key material. */
export async function deriveEcdhSharedSecretBits(
  recipientPublicKey: CryptoKey,
  senderPrivateKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    senderPrivateKey,
    256,
  );
}

export type PerRecipientKek = {
  kek: CryptoKey;
  hkdfSalt: Uint8Array<ArrayBuffer>;
};

/** One recipient bound to their ECDHE-derived KEK + HKDF salt (no parallel arrays). */
export type ManifestRecipientKeysWithKek = ManifestRecipientKeys &
  PerRecipientKek;

/** Import ECDHE shared secret bits as Web Crypto HKDF key material (`deriveKey` base key). */
export async function importSharedSecretAsHkdfKeyMaterial(
  sharedSecret: ArrayBuffer,
): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
    'deriveKey',
  ]);
}

/**
 * HKDF-expand to an AES-GCM key. Caller must supply `salt` explicitly.
 * Use {@link deriveAesGcmKekFromHkdfMaterial} when a random per-operation salt
 * should be generated and returned (manifest DEK encryption path).
 */
export type DeriveAesGcmKeyFromHkdfOptions = {
  info?: Uint8Array<ArrayBuffer>;
  extractable?: boolean;
  keyUsages?: KeyUsage[];
};

export async function deriveAesGcmKeyFromHkdfMaterial(
  hkdfKeyMaterial: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  options: DeriveAesGcmKeyFromHkdfOptions = {},
): Promise<CryptoKey> {
  const extractable = options.extractable ?? false;
  const keyUsages = options.keyUsages ?? ['encrypt'];
  const info = options.info ?? HKDF_INFO;
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.slice().buffer,
      info,
    },
    hkdfKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    extractable,
    keyUsages,
  );
}

/**
 * Random HKDF salt + HKDF-expand to an AES-GCM KEK (`HKDF_INFO`; salt is stored in the manifest on encrypt).
 * `extractable` is true in the step-by-step UI so raw key bytes can be shown; false in one-shot flow.
 */
export type DeriveAesGcmKekOptions = {
  /** Omit on encrypt (random salt); required on decrypt (salt from key manifest entry). */
  salt?: Uint8Array<ArrayBuffer>;
  extractable?: boolean;
  keyUsages?: KeyUsage[];
};

export async function deriveAesGcmKekFromHkdfMaterial(
  hkdfKeyMaterial: CryptoKey,
  options: DeriveAesGcmKekOptions = {},
): Promise<PerRecipientKek> {
  const hkdfSalt =
    options.salt ?? crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH));
  const kek = await deriveAesGcmKeyFromHkdfMaterial(hkdfKeyMaterial, hkdfSalt, {
    extractable: options.extractable,
    keyUsages: options.keyUsages,
  });
  return { kek, hkdfSalt };
}

/**
 * Step 2 (HKDF): random salt + AES-GCM KEK from shared secret (salt matches what is stored in the manifest).
 * Composes `importSharedSecretAsHkdfKeyMaterial` → `deriveAesGcmKekFromHkdfMaterial`.
 */
export async function deriveKekFromSharedSecret(
  sharedSecret: ArrayBuffer,
  options: DeriveAesGcmKekOptions = {},
): Promise<PerRecipientKek> {
  const hkdfKeyMaterial =
    await importSharedSecretAsHkdfKeyMaterial(sharedSecret);
  return deriveAesGcmKekFromHkdfMaterial(hkdfKeyMaterial, options);
}

/**
 * Web Crypto `exportKey('jwk')` adds `ext` and `key_ops`, which are not needed on the wire and
 * are not part of the minimal JWK material RFC 7517 describes for EC public keys (`kty`, `crv`, `x`, `y`).
 */
function slimEcPublicJwkForWire(jwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y } = jwk;
  if (kty !== 'EC' || !crv || !x || !y) {
    throw new Error('Expected EC public JWK with kty, crv, x, y');
  }
  return { kty, crv, x, y };
}

/** Serialize a `CryptoKey` for JSON (EC public key: minimal JWK for transfer). */
export async function exportCryptoKeyAsJwk(
  key: CryptoKey,
): Promise<JsonWebKey> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return slimEcPublicJwkForWire(jwk);
}

export function encryptedContentToSignableBody({
  plaintextIv,
  ciphertext,
}: ManifestEncryptedContent): {
  iv: string;
  ciphertext: string;
} {
  return {
    iv: bytesToBase64(plaintextIv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/** AES-GCM: encrypt raw DEK bytes with the per-recipient KEK (random 12-byte IV). */
async function aesGcmEncryptDekBytes(
  kek: CryptoKey,
  dekBytes: ArrayBuffer,
): Promise<{ iv: Uint8Array<ArrayBuffer>; encryptedDek: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedDek = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    dekBytes,
  );
  return { iv, encryptedDek };
}

async function buildKeyManifestEntryForRecipient(
  recipientPublicKey: CryptoKey,
  rawDek: ArrayBuffer,
  kek: CryptoKey,
  hkdfSalt: Uint8Array<ArrayBuffer>,
  keyId: string,
): Promise<KeyManifestRecipientPayload> {
  const { iv, encryptedDek } = await aesGcmEncryptDekBytes(kek, rawDek);
  const publicKey = await exportCryptoKeyAsJwk(recipientPublicKey);

  return {
    keyId,
    publicKey,
    iv: bytesToBase64(iv),
    salt: bytesToBase64(hkdfSalt),
    encryptedDek: bytesToBase64(new Uint8Array(encryptedDek)),
  };
}

export type ManifestDek = {
  dek: CryptoKey;
  rawDek: ArrayBuffer;
};

/** Random AES-GCM DEK — encrypts the UTF-8 message into `encryptedContent`; raw bytes are encrypted per recipient in `keyManifest`. */
export async function generateManifestDek(): Promise<ManifestDek> {
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt'],
  );
  const rawDek = await crypto.subtle.exportKey('raw', dek);
  return { dek, rawDek };
}

export type ManifestEncryptedContent = {
  plaintextIv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};

/** Random IV + AES-GCM ciphertext for the manifest message body (`encryptedContent`). */
export async function aesGcmEncryptManifestBody(
  dek: CryptoKey,
  plaintext: string,
): Promise<ManifestEncryptedContent> {
  const plaintextIv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: plaintextIv },
    dek,
    new TextEncoder().encode(plaintext),
  );
  return { plaintextIv, ciphertext };
}

/**
 * ECDHE(agreement private × recipient public) → HKDF → KEK per recipient.
 * Use agreement key from {@link generateManifestEphemeralAgreementKeyPair} once per manifest.
 */
export async function derivePerRecipientKek(
  recipients: ManifestRecipientKeys[],
  agreementPrivateKey: CryptoKey,
): Promise<ManifestRecipientKeysWithKek[]> {
  return Promise.all(
    recipients.map(async (r) => {
      const sharedSecret = await deriveEcdhSharedSecretBits(
        r.publicKey,
        agreementPrivateKey,
      );
      const perRecipientKek = await deriveKekFromSharedSecret(sharedSecret);
      return {
        ...r,
        ...perRecipientKek,
      };
    }),
  );
}

/**
 * Encrypt the DEK for each recipient using pre-derived KEKs + HKDF salts (e.g. step-by-step UI).
 */
export async function encryptManifestWithPerRecipientKek(
  recipientsWithKek: ManifestRecipientKeysWithKek[],
  { rawDek }: Pick<ManifestDek, 'rawDek'>,
): Promise<KeyManifestMap> {
  return Object.fromEntries(
    await Promise.all(
      recipientsWithKek.map(async (r) => {
        const { kek, hkdfSalt, publicKey, keyId } = r;
        const entry = await buildKeyManifestEntryForRecipient(
          publicKey,
          rawDek,
          kek,
          hkdfSalt,
          keyId,
        );
        return [keyId, entry] as const;
      }),
    ),
  );
}

/** Build the manifest assembly (step-by-step step 6; signing starts in step 7). */
export async function buildManifestAssembly(
  senderPublicKey: CryptoKey,
  senderAgreementEphemeralPublicKey: CryptoKey,
  encryptedContent: ManifestEncryptedContent,
  keyManifest: KeyManifestMap,
): Promise<ManifestAssembly> {
  const senderPublicJwk = await exportCryptoKeyAsJwk(senderPublicKey);
  const ephemeralPublicKey = await exportCryptoKeyAsJwk(
    senderAgreementEphemeralPublicKey,
  );

  return {
    version: MANIFEST_VERSION,
    wrap: MANIFEST_WRAP,
    senderPublicJwk,
    ephemeralPublicKey,
    encryptedContent: encryptedContentToSignableBody(encryptedContent),
    keyManifest,
  };
}

/** Assemble wire-format manifest JSON from pre-derived crypto material. */
export async function buildManifestPayload(
  senderPublicKey: CryptoKey,
  senderSigningPrivateKey: CryptoKey,
  senderAgreementEphemeralPublicKey: CryptoKey,
  { plaintextIv, ciphertext }: ManifestEncryptedContent,
  keyManifest: KeyManifestMap,
): Promise<string> {
  const signableBody = await buildManifestAssembly(
    senderPublicKey,
    senderAgreementEphemeralPublicKey,
    { plaintextIv, ciphertext },
    keyManifest,
  );

  const senderSignature = await signManifestBody(
    senderSigningPrivateKey,
    signableBody,
  );

  return JSON.stringify({ senderSignature, ...signableBody }, null, 2);
}

export async function recipientsIncludingSender(
  recipients: ManifestRecipientKeys[],
  senderPublicKey: CryptoKey,
): Promise<ManifestRecipientKeys[]> {
  const senderPublicJwk = await exportCryptoKeyAsJwk(senderPublicKey);
  const senderKeyId = await ecPublicJwkThumbprintSha256(senderPublicJwk);
  if (recipients.some((recipient) => recipient.keyId === senderKeyId)) {
    return recipients;
  }
  return [...recipients, { keyId: senderKeyId, publicKey: senderPublicKey }];
}

/**
 * Key manifest: one AES-GCM ciphertext of the message + encrypted DEK per recipient.
 * The sender is always included so they can decrypt their own copy later.
 */
export async function encryptWithManifest(
  plaintext: string,
  recipients: ManifestRecipientKeys[],
  senderPublicKey: CryptoKey,
  senderSigningPrivateKey: CryptoKey,
): Promise<string> {
  const allRecipients = await recipientsIncludingSender(
    recipients,
    senderPublicKey,
  );
  const ephemeralKeyPair = await generateManifestEphemeralAgreementKeyPair();
  const recipientsWithKek = await derivePerRecipientKek(
    allRecipients,
    ephemeralKeyPair.privateKey,
  );
  const dekMaterial = await generateManifestDek();
  const encryptedContent = await aesGcmEncryptManifestBody(
    dekMaterial.dek,
    plaintext,
  );
  const keyManifest = await encryptManifestWithPerRecipientKek(
    recipientsWithKek,
    dekMaterial,
  );
  return buildManifestPayload(
    senderPublicKey,
    senderSigningPrivateKey,
    ephemeralKeyPair.publicKey,
    encryptedContent,
    keyManifest,
  );
}
