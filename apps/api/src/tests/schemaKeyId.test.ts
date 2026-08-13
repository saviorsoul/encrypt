import { describe, expect, it } from 'vitest';
import {
  keyIdProperty,
  keyManifestSchema,
  schemaDefinitions,
} from '../schemas/common.js';

const KEY_ID_FIELD = /^(?:keyId|.*KeyId)$/;

type JsonSchema = Record<string, unknown>;

function walkSchema(
  schema: unknown,
  visit: (fieldName: string, fieldSchema: unknown) => void,
): void {
  if (!schema || typeof schema !== 'object') {
    return;
  }

  const node = schema as JsonSchema;

  const properties = node.properties;
  if (properties && typeof properties === 'object') {
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      if (KEY_ID_FIELD.test(fieldName)) {
        visit(fieldName, fieldSchema);
      }
      walkSchema(fieldSchema, visit);
    }
  }

  const additionalProperties = node.additionalProperties;
  if (additionalProperties && typeof additionalProperties === 'object') {
    walkSchema(additionalProperties, visit);
  }

  for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
    const branches = node[keyword];
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        walkSchema(branch, visit);
      }
    }
  }
}

describe('schema keyId fields', () => {
  it('uses keyIdProperty for every keyId / *KeyId field', () => {
    for (const [schemaName, schema] of Object.entries(schemaDefinitions)) {
      walkSchema(schema, (fieldName, fieldSchema) => {
        expect(fieldSchema, `${schemaName}.${fieldName}`).toBe(keyIdProperty);
      });
    }
  });

  it('validates keyManifest map keys with keyIdProperty', () => {
    expect(keyManifestSchema.propertyNames).toBe(keyIdProperty);
  });
});
