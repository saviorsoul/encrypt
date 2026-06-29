import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { schemaDefinitions, type SchemaName } from '../schemas/common.js';

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  removeAdditional: false,
});

const validators = new Map<SchemaName, ValidateFunction>();

for (const [name, schema] of Object.entries(schemaDefinitions) as Array<
  [SchemaName, (typeof schemaDefinitions)[SchemaName]]
>) {
  validators.set(name, ajv.compile(schema));
}

export function getValidator(schemaName: SchemaName): ValidateFunction {
  const validator = validators.get(schemaName);
  if (!validator) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }
  return validator;
}

export function formatAjvErrors(errors: ValidateFunction['errors']): string {
  if (!errors?.length) {
    return 'Request body validation failed.';
  }

  const messages = errors.map((error) => {
    const path = error.instancePath || '(root)';
    const detail = error.message ?? 'invalid value';
    return `${path}: ${detail}`;
  });

  return messages.join('; ');
}
