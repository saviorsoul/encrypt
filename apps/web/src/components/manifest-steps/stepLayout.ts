export type ManifestCryptoFlow = 'encrypt' | 'decrypt';

export const ENCRYPT_DECRYPT_POC_PATH = '/proof-of-concepts/encrypt-decrypt';

/** Fragment id for a numbered step in the encrypt/decrypt walkthrough. */
export function manifestStepId(flow: ManifestCryptoFlow, step: number): string {
  return `${flow}-step-${step}`;
}

/** Fragment id for the encrypt or decrypt section heading block. */
export function manifestFlowSectionId(flow: ManifestCryptoFlow): string {
  return `${flow}-flow`;
}

/** In-app link to a numbered encrypt/decrypt walkthrough step. */
export function manifestStepHref(
  flow: ManifestCryptoFlow,
  step: number,
): string {
  return `${ENCRYPT_DECRYPT_POC_PATH}#${manifestStepId(flow, step)}`;
}

export const stepContentSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  pt: 1,
  pb: 2,
} as const;

export const manifestStepScrollMarginSx = {
  scrollMarginTop: 50,
} as const;
