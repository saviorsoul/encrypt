const CHAR_WIDTH_PX = 8.2;
const MIN_BAR_CHARS = 3;
const MAX_BAR_CHARS = 11;
const AES_GCM_TAG_BYTES = 16;
const PREVIEW_CHARS_PER_WORD = 7;

function hashSeed(seed: string): number {
  return seed
    .split('')
    .reduce(
      (accumulator, char) => (accumulator * 31 + char.charCodeAt(0)) >>> 0,
      0,
    );
}

function base64DecodedByteLength(base64: string): number {
  const trimmed = base64.trim();
  if (!trimmed) {
    return 0;
  }

  const padding = trimmed.endsWith('==') ? 2 : trimmed.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

export function estimatedPlaintextCharCountFromPayload(
  payloadJson: string,
): number {
  try {
    const parsed = JSON.parse(payloadJson) as {
      encryptedContent?: { ciphertext?: string };
    };
    const ciphertext = parsed.encryptedContent?.ciphertext;
    if (typeof ciphertext === 'string' && ciphertext.length > 0) {
      const cipherBytes = base64DecodedByteLength(ciphertext);
      return Math.max(1, cipherBytes - AES_GCM_TAG_BYTES);
    }
  } catch {
    // Fall back to a coarse estimate below.
  }

  return Math.max(10, Math.floor(payloadJson.length / 8));
}

function barCharLengthFromSeed(
  seed: string,
  index: number,
  maxLen: number,
): number {
  let hash = hashSeed(seed);
  hash = (Math.imul(hash ^ (index + 1), 1_664_525) + 1_013_904_223) >>> 0;
  const range = Math.max(1, maxLen - MIN_BAR_CHARS + 1);
  return MIN_BAR_CHARS + (hash % range);
}

function distributeBarCharLengths(seed: string, targetChars: number): number[] {
  if (targetChars <= 0) {
    return [];
  }

  const lengths: number[] = [];
  let remaining = targetChars;

  while (remaining > 0) {
    if (lengths.length > 0) {
      if (remaining === 1) {
        lengths[lengths.length - 1] += 1;
        break;
      }

      remaining -= 1;
      if (remaining <= 0) {
        break;
      }
    }

    if (remaining < MIN_BAR_CHARS) {
      if (lengths.length === 0) {
        lengths.push(remaining);
      } else {
        lengths[lengths.length - 1] += remaining;
      }
      break;
    }

    const length = barCharLengthFromSeed(
      seed,
      lengths.length,
      Math.min(MAX_BAR_CHARS, remaining),
    );
    lengths.push(length);
    remaining -= length;
  }

  return lengths;
}

const GRAYSCALE_SATURATION = 0;
const GRAYSCALE_LIGHTNESS_MIN = 38;
const GRAYSCALE_LIGHTNESS_RANGE = 40;

export function redactedBarColorFromSeed(seed: string, index: number): string {
  let hash = hashSeed(seed);
  hash = (Math.imul(hash ^ (index + 1), 1_664_525) + 1_013_904_223) >>> 0;

  const lightness =
    GRAYSCALE_LIGHTNESS_MIN + (hash % (GRAYSCALE_LIGHTNESS_RANGE + 1));
  return `hsl(0 ${GRAYSCALE_SATURATION}% ${lightness}%)`;
}

export function redactedBarsFromSeed(
  seed: string,
  maxPreviewWords?: number,
): Array<{ widthPx: number; color: string }> {
  const estimatedChars = estimatedPlaintextCharCountFromPayload(seed);
  const previewCap = maxPreviewWords
    ? maxPreviewWords * PREVIEW_CHARS_PER_WORD
    : estimatedChars;
  const targetChars = Math.min(estimatedChars, previewCap);
  const lengths = distributeBarCharLengths(seed, targetChars);

  return lengths.map((length, index) => ({
    widthPx: length * CHAR_WIDTH_PX,
    color: redactedBarColorFromSeed(seed, index),
  }));
}
