import { safeStorage } from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

/**
 * Linux `safeStorage.getSelectedStorageBackend()` value when no OS secret store is
 * available (or when Electron is started with `--password-store=basic`). Electron
 * documents this string but does not export it as a constant — see
 * https://www.electronjs.org/docs/latest/api/safe-storage#getselectedstoragebackend-linux
 */
export const BASIC_TEXT_STORAGE_BACKEND = 'basic_text';

/** RFC 7638 SHA-256 thumbprint encoded as unpadded base64url (43 chars). */
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function assertValidKeyId(keyId) {
  if (typeof keyId !== 'string' || !KEY_ID_PATTERN.test(keyId)) {
    throw new Error('Invalid private key id.');
  }
}

function storageDir(userDataPath) {
  return path.join(userDataPath, 'safe-private-keys');
}

function keyFilePath(userDataPath, keyId) {
  assertValidKeyId(keyId);
  return path.join(storageDir(userDataPath), `${keyId}.bin`);
}

export function getPrivateKeyEncryptionBackend() {
  if (typeof safeStorage.getSelectedStorageBackend !== 'function') {
    return safeStorage.isEncryptionAvailable() ? 'unknown' : null;
  }

  return safeStorage.getSelectedStorageBackend();
}

export function getPrivateKeyEncryptionStatus() {
  const backend = getPrivateKeyEncryptionBackend();

  if (backend === BASIC_TEXT_STORAGE_BACKEND) {
    return { available: false, backend, reason: 'basic_text' };
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return { available: false, backend, reason: 'unavailable' };
  }

  return { available: true, backend, reason: null };
}

export function isPrivateKeyEncryptionAvailable() {
  return getPrivateKeyEncryptionStatus().available;
}

export async function storePrivateKeyJwk(userDataPath, keyId, jwkText) {
  if (!isPrivateKeyEncryptionAvailable()) {
    throw new Error('OS encryption is not available.');
  }
  if (typeof jwkText !== 'string' || !jwkText.trim()) {
    throw new Error('Private key text must be a non-empty string.');
  }

  const encrypted = safeStorage.encryptString(jwkText);
  const dir = storageDir(userDataPath);
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.writeFile(keyFilePath(userDataPath, keyId), encrypted);
}

export async function loadPrivateKeyJwk(userDataPath, keyId) {
  if (!isPrivateKeyEncryptionAvailable()) {
    return null;
  }

  assertValidKeyId(keyId);
  const filePath = keyFilePath(userDataPath, keyId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const encrypted = await fsPromises.readFile(filePath);
  try {
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

export async function deletePrivateKeyJwk(userDataPath, keyId) {
  assertValidKeyId(keyId);
  const filePath = keyFilePath(userDataPath, keyId);
  if (!fs.existsSync(filePath)) {
    return;
  }

  await fsPromises.unlink(filePath);
}

export async function clearAllStoredPrivateKeys(userDataPath) {
  const dir = storageDir(userDataPath);
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = await fsPromises.readdir(dir);
  await Promise.all(
    entries.map((name) => fsPromises.unlink(path.join(dir, name))),
  );
}

export async function listStoredPrivateKeyIds(userDataPath) {
  const dir = storageDir(userDataPath);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = await fsPromises.readdir(dir);
  return entries
    .filter((name) => name.endsWith('.bin'))
    .map((name) => name.slice(0, -4))
    .filter((keyId) => KEY_ID_PATTERN.test(keyId));
}

export async function loadSoleStoredPrivateKeyJwk(userDataPath) {
  const keyIds = await listStoredPrivateKeyIds(userDataPath);
  if (keyIds.length !== 1) {
    return null;
  }

  const jwkText = await loadPrivateKeyJwk(userDataPath, keyIds[0]);
  if (!jwkText) {
    return null;
  }

  return { keyId: keyIds[0], jwkText };
}

export function hasStoredPrivateKey(userDataPath, keyId) {
  assertValidKeyId(keyId);
  return fs.existsSync(keyFilePath(userDataPath, keyId));
}
