import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { readConfig } from '../config.js';
import { schemaDefinitions, type SchemaName } from '../schemas/common.js';

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  removeAdditional: false,
});

addFormats(ajv);

ajv.addKeyword({
  keyword: 'stripAfterValidation',
  schemaType: 'array',
  modifying: true,
  post: true,
  metaSchema: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
  },
  validate(properties: string[], data: Record<string, unknown>) {
    for (const property of properties) {
      delete data[property];
    }
    return true;
  },
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

export type ValidationErrorDetail = {
  path: string;
  keyword: string;
  message: string;
  additionalProperty?: string;
};

export type FormattedAjvErrors = {
  message: string;
  details?: ValidationErrorDetail[];
};

function errorPath(error: ErrorObject): string {
  return error.instancePath || '(root)';
}

function formatAdditionalPropertyErrors(
  errors: ErrorObject[],
): FormattedAjvErrors {
  const keysByPath = new Map<string, string[]>();

  for (const error of errors) {
    if (error.keyword !== 'additionalProperties') {
      continue;
    }
    const key = error.params?.additionalProperty;
    if (typeof key !== 'string') {
      continue;
    }
    const path = errorPath(error);
    const keys = keysByPath.get(path) ?? [];
    keys.push(key);
    keysByPath.set(path, keys);
  }

  const messages: string[] = [];
  const details: ValidationErrorDetail[] = [];

  for (const [path, keys] of keysByPath) {
    const quoted = keys.map((key) => `"${key}"`).join(', ');
    messages.push(`${path}: unknown additional properties: ${quoted}`);
    for (const key of keys) {
      details.push({
        path,
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        additionalProperty: key,
      });
    }
  }

  return { message: messages.join('; '), details };
}

function formatGenericErrors(errors: ErrorObject[]): string {
  return errors
    .map((error) => {
      const path = errorPath(error);
      const detail = error.message ?? 'invalid value';
      return `${path}: ${detail}`;
    })
    .join('; ');
}

function toValidationDetails(errors: ErrorObject[]): ValidationErrorDetail[] {
  return errors.map((error) => {
    const detail: ValidationErrorDetail = {
      path: errorPath(error),
      keyword: error.keyword,
      message: error.message ?? 'invalid value',
    };
    const additionalProperty = error.params?.additionalProperty;
    if (typeof additionalProperty === 'string') {
      detail.additionalProperty = additionalProperty;
    }
    return detail;
  });
}

/** Format AJV errors for API responses; dev responses include structured details. */
export function formatAjvErrors(
  errors: ValidateFunction['errors'],
): FormattedAjvErrors {
  if (!errors?.length) {
    return { message: 'Request validation failed.' };
  }

  const { isDev } = readConfig();

  if (!isDev) {
    return { message: formatGenericErrors(errors) };
  }

  const additionalPropertyErrors = errors.filter(
    (error) => error.keyword === 'additionalProperties',
  );
  const otherErrors = errors.filter(
    (error) => error.keyword !== 'additionalProperties',
  );

  const parts: string[] = [];

  if (additionalPropertyErrors.length > 0) {
    parts.push(
      formatAdditionalPropertyErrors(additionalPropertyErrors).message,
    );
  }

  if (otherErrors.length > 0) {
    parts.push(formatGenericErrors(otherErrors));
  }

  return {
    message: parts.join('; ') || 'Request validation failed.',
    details: toValidationDetails(errors),
  };
}
