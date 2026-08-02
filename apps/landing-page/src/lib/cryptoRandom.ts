const UINT32_SPACE = 2 ** 32;

function getCryptoUint32(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

function getFairUint32(range: number): number {
  const maxFairValue = Math.floor(UINT32_SPACE / range) * range - 1;

  let value = getCryptoUint32();
  while (value > maxFairValue) {
    value = getCryptoUint32();
  }

  return value;
}

export function randomIntBetween(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);

  if (upper < lower) {
    throw new RangeError(
      'randomIntBetween: max must be greater than or equal to min',
    );
  }

  const range = upper - lower + 1;
  return lower + (getFairUint32(range) % range);
}
