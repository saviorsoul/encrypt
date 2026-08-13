import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import {
  querySchemaDefinitions,
  queryWireSchemaDefinitions,
  type QuerySchemaName,
} from '../schemas/common.js';

export type { QuerySchemaName };

const queryValidateAjv = new Ajv2020({
  strict: true,
  allErrors: true,
  removeAdditional: false,
});

const queryNormalizeAjv = new Ajv2020({
  strict: true,
  allErrors: true,
  removeAdditional: false,
  coerceTypes: true,
  useDefaults: true,
});

addFormats(queryValidateAjv);
addFormats(queryNormalizeAjv);

queryNormalizeAjv.addKeyword({
  keyword: 'enumAliases',
  schemaType: 'object',
  modifying: true,
  before: 'enum',
  metaSchema: {
    type: 'object',
    additionalProperties: { type: 'string' },
  },
  compile(aliases: Record<string, string>) {
    return function validate(
      data: unknown,
      dataCxt?: {
        parentData: Record<string, unknown>;
        parentDataProperty: string | number;
      },
    ) {
      if (typeof data !== 'string' || !dataCxt?.parentData) {
        return true;
      }

      const normalized = aliases[data];
      if (normalized !== undefined) {
        dataCxt.parentData[dataCxt.parentDataProperty] = normalized;
      }

      return true;
    };
  },
});

const queryValidators = new Map<QuerySchemaName, ValidateFunction>();
const queryNormalizers = new Map<QuerySchemaName, ValidateFunction>();

for (const [name, schema] of Object.entries(
  queryWireSchemaDefinitions,
) as Array<
  [QuerySchemaName, (typeof queryWireSchemaDefinitions)[QuerySchemaName]]
>) {
  queryValidators.set(name, queryValidateAjv.compile(schema));
}

for (const [name, schema] of Object.entries(querySchemaDefinitions) as Array<
  [QuerySchemaName, (typeof querySchemaDefinitions)[QuerySchemaName]]
>) {
  queryNormalizers.set(name, queryNormalizeAjv.compile(schema));
}

export function getQueryValidator(
  schemaName: QuerySchemaName,
): ValidateFunction {
  const validator = queryValidators.get(schemaName);
  if (!validator) {
    throw new Error(`Unknown query schema: ${schemaName}`);
  }
  return validator;
}

export function getQueryNormalizer(
  schemaName: QuerySchemaName,
): ValidateFunction {
  const normalizer = queryNormalizers.get(schemaName);
  if (!normalizer) {
    throw new Error(`Unknown query schema: ${schemaName}`);
  }
  return normalizer;
}
