import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import {
  headerSchemaDefinitions,
  type HeaderSchemaName,
} from '../schemas/common.js';

export type { HeaderSchemaName };

const headerAjv = new Ajv2020({
  strict: true,
  allErrors: true,
  removeAdditional: false,
});

addFormats(headerAjv);

const headerValidators = new Map<HeaderSchemaName, ValidateFunction>();

for (const [name, schema] of Object.entries(headerSchemaDefinitions) as Array<
  [HeaderSchemaName, (typeof headerSchemaDefinitions)[HeaderSchemaName]]
>) {
  headerValidators.set(name, headerAjv.compile(schema));
}

export function getHeaderValidator(
  schemaName: HeaderSchemaName,
): ValidateFunction {
  const validator = headerValidators.get(schemaName);
  if (!validator) {
    throw new Error(`Unknown header schema: ${schemaName}`);
  }
  return validator;
}
