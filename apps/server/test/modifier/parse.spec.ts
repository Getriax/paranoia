import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modifierResponseSchema } from '../../src/modifier/modifier.types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function loadFixture(name: string): unknown {
  const raw = readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
  return JSON.parse(raw);
}

function stripNullOptionals(parsed: unknown): unknown {
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = { ...(parsed as Record<string, unknown>) };
    for (const key of [
      'modified_message',
      'reasoning',
      'confidence_will_fool',
    ] as const) {
      if (obj[key] === null) delete obj[key];
    }
    return obj;
  }
  return parsed;
}

describe('modifier fixtures', () => {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort();

  it('has 20 fixtures (10 normal + 5 edge + 5 malformed)', () => {
    expect(files.length).toBe(20);
    expect(files.filter((f) => f.startsWith('normal-')).length).toBe(10);
    expect(files.filter((f) => f.startsWith('edge-')).length).toBe(5);
    expect(files.filter((f) => f.startsWith('malformed-')).length).toBe(5);
  });

  describe('normal-* fixtures parse successfully', () => {
    const normals = files.filter((f) => f.startsWith('normal-'));
    for (const f of normals) {
      it(f, () => {
        const data = stripNullOptionals(loadFixture(f));
        const result = modifierResponseSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    }
  });

  describe('edge-* fixtures parse successfully (after null-strip)', () => {
    const edges = files.filter((f) => f.startsWith('edge-'));
    for (const f of edges) {
      it(f, () => {
        const data = stripNullOptionals(loadFixture(f));
        const result = modifierResponseSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    }
  });

  describe('malformed-* fixtures fail parsing', () => {
    const malformeds = files.filter((f) => f.startsWith('malformed-'));
    for (const f of malformeds) {
      it(f, () => {
        const data = stripNullOptionals(loadFixture(f));
        const result = modifierResponseSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    }
  });
});

describe('passthrough semantics', () => {
  it('modify=true without modified_message is treated as no-op', () => {
    const data = stripNullOptionals(loadFixture('edge-01-modify-no-text.json')) as {
      modify: boolean;
      modified_message?: string;
    };
    const wasModified =
      data.modify === true && typeof data.modified_message === 'string';
    expect(wasModified).toBe(false);
  });

  it('modify=true with empty modified_message string is technically valid (operational decision)', () => {
    const data = stripNullOptionals(loadFixture('edge-02-empty-modified.json')) as {
      modify: boolean;
      modified_message?: string;
    };
    const wasModified =
      data.modify === true && typeof data.modified_message === 'string';
    expect(wasModified).toBe(true);
    expect(data.modified_message).toBe('');
  });
});
