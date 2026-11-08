import { configJsonSchema } from './json-schema.js';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cell = (text: string): string => text.replaceAll('|', '\\|');

function typeOf(schema: Json): string {
  if (schema['const'] !== undefined) return `\`${JSON.stringify(schema['const'])}\``;
  if (Array.isArray(schema['enum'])) {
    return schema['enum'].map((value) => `\`${JSON.stringify(value)}\``).join(', ');
  }
  switch (schema['type']) {
    case 'string':
      return 'text';
    case 'integer':
    case 'number': {
      const { minimum, maximum } = schema;
      return typeof minimum === 'number' && typeof maximum === 'number'
        ? `number, ${String(minimum)} to ${String(maximum)}`
        : 'number';
    }
    case 'boolean':
      return 'true or false';
    case 'array':
      return isObject(schema['items']) ? `list of ${typeOf(schema['items'])}` : 'list';
    case 'object':
      return schema['properties'] === undefined ? 'map' : 'object';
    default:
      return 'any';
  }
}

function defaultOf(schema: Json, required: boolean): string {
  if (required) return 'required';
  const value = schema['default'];
  if (value === undefined) return 'optional';
  const text = JSON.stringify(value);
  return isObject(value) || text.length > 24 ? 'see below' : `\`${text}\``;
}

function rows(schema: Json, prefix: string): string[] {
  const properties = schema['properties'];
  if (!isObject(properties)) return [];
  const required = Array.isArray(schema['required']) ? schema['required'] : [];
  return Object.entries(properties).flatMap(([name, value]) => {
    if (!isObject(value) || name === '$schema') return [];
    const path = `${prefix}${name}`;
    const description = typeof value['description'] === 'string' ? value['description'] : '';
    const row = `| \`${path}\` | ${typeOf(value)} | ${cell(defaultOf(value, required.includes(name)))} | ${cell(description)} |`;
    const items = isObject(value['items']) ? value['items'] : undefined;
    return [row, ...rows(value, `${path}.`), ...(items ? rows(items, `${path}[].`) : [])];
  });
}

function table(which: 'office' | 'machine'): string {
  return [
    '| Field | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    ...rows(configJsonSchema(which), ''),
  ].join('\n');
}

/**
 * Builds `docs/configuration-reference.md` from the schemas, so the reference
 * can't drift from what the code accepts.
 *
 * @returns The Markdown page.
 */
export function configReference(): string {
  return `# Configuration reference

This page is generated from the schemas in \`packages/schema\`. To change it, change them. For how the two files fit together, see [Configuration](configuration.md).

## \`office.config.json\`

The public office config. It is served to every visitor.

${table('office')}

## \`~/.config/hivefloor/config.json\`

The private machine config. It never leaves your machine.

${table('machine')}
`;
}
