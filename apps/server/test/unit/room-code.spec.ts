import { describe, it, expect } from 'vitest';
import { generateRoomCode, generateSessionToken } from '../../src/lobby/room-code.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORBIDDEN = new Set(['I', 'L', 'O', '0', '1']);

describe('generateRoomCode', () => {
  it('produces a 6-character code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('uses only the unambiguous alphabet (no I/L/O/0/1)', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(FORBIDDEN.has(ch)).toBe(false);
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  it('exhibits very low collision rate over 1000 generations', () => {
    const seen = new Set<string>();
    let collisions = 0;
    for (let i = 0; i < 1000; i += 1) {
      const code = generateRoomCode();
      if (seen.has(code)) collisions += 1;
      seen.add(code);
    }
    // 31^6 ≈ 887M permutations; 1000 generations should very rarely collide.
    expect(collisions).toBeLessThan(3);
  });
});

describe('generateSessionToken', () => {
  it('produces a 64-char hex string', () => {
    const t = generateSessionToken();
    expect(t).toHaveLength(64);
    expect(t).toMatch(/^[0-9a-f]+$/);
  });

  it('produces unique tokens', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      seen.add(generateSessionToken());
    }
    expect(seen.size).toBe(100);
  });
});
