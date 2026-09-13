import type { ValidateFunction } from 'ajv';
import type { AuthHeadersWire } from '../schemas/common.js';
import { getHeaderValidator } from '../lib/headerAjv.js';

const validateAuthHeadersWire = getHeaderValidator('authHeadersWire');

export type AuthHeadersWireValidation = {
  valid: boolean;
  errors: ValidateFunction['errors'];
};

export function validateAuthHeadersWireResult(
  wire: AuthHeadersWire,
): AuthHeadersWireValidation {
  const valid = validateAuthHeadersWire(wire) === true;
  return { valid, errors: validateAuthHeadersWire.errors };
}
