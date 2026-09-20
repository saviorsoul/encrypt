import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { jwkWithoutKeyOps } from '@encrypt/core/crypto/ecdhKeys';
import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';

export type TestKeyMaterial = Awaited<
  ReturnType<typeof importUploadedPrivateKeyMaterial>
>;

export type TestPrivateKeyFile = {
  filePath: string;
  keyId: string;
  material: TestKeyMaterial;
};

export async function generateTestKeyMaterial() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const privateJwk = slimEcPrivateJwk(
    (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
  );
  return importUploadedPrivateKeyMaterial(privateJwk);
}

export async function loadTestKeyMaterialFromFile(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  const privateJwk = slimEcPrivateJwk(JSON.parse(raw) as JsonWebKey);
  return importUploadedPrivateKeyMaterial(privateJwk);
}

export async function writePrivateKeyFileAt(
  filePath: string,
): Promise<TestPrivateKeyFile> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const privateJwk = slimEcPrivateJwk(
    (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
  );
  const material = await importUploadedPrivateKeyMaterial(privateJwk);
  await writeFile(
    filePath,
    `${JSON.stringify(jwkWithoutKeyOps(privateJwk), null, 2)}\n`,
    'utf8',
  );
  return { filePath, keyId: material.keyId, material };
}

export async function writeTestPrivateKeyFile(): Promise<TestPrivateKeyFile> {
  const dir = await mkdtemp(path.join(tmpdir(), 'feed-lab-e2e-'));
  const filePath = path.join(dir, 'test-private-key.json');
  return writePrivateKeyFileAt(filePath);
}
