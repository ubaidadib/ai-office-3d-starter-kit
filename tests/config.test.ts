// Checks on office.config.ts, so a customised office cannot ship with a missing translation or a broken file path.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import config, { type Text } from '../office.config';
import { ROOMS } from '../src/model/floorplan';

/** Every { en, ar } pair anywhere in the config, with its path. */
function texts(node: unknown, path = 'config'): [string, Text][] {
  if (!node || typeof node !== 'object') return [];
  const o = node as Record<string, unknown>;
  if (typeof o.en === 'string' && typeof o.ar === 'string') return [[path, o as unknown as Text]];
  return Object.entries(o).flatMap(([k, v]) => texts(v, `${path}.${k}`));
}

const ARABIC = /[؀-ۿ]/;
const HEX = /^#[0-9a-fA-F]{6}$/;

describe('office.config.ts', () => {
  const all = texts(config);

  it('has text in both languages for every on-screen string', () => {
    expect(all.length).toBeGreaterThan(30);
    for (const [path, x] of all) {
      expect(x.en.trim(), `${path}.en is empty`).not.toBe('');
      expect(x.ar.trim(), `${path}.ar is empty`).not.toBe('');
    }
  });

  it('the Arabic text is written in Arabic script (except short codes such as "COO")', () => {
    for (const [path, x] of all) if (x.ar.length > 4 && !/^[A-Z0-9 ·×.-]+$/.test(x.ar)) expect(x.ar, path).toMatch(ARABIC);
  });

  it('names all 13 rooms, in both languages, without duplicates', () => {
    expect(Object.keys(config.rooms).sort()).toEqual(ROOMS.map((r) => r.id).sort());
    for (const lang of ['en', 'ar'] as const) {
      const names = Object.values(config.rooms).map((r) => r[lang]);
      expect(new Set(names).size, lang).toBe(names.length);
    }
  });

  it('uses valid colours, and no role colour is a pure green (traditionally reserved for "live")', () => {
    expect(config.brand.primary).toMatch(HEX);
    expect(config.brand.accent).toMatch(HEX);
    for (const r of Object.values(config.roles)) {
      expect(r.color).toMatch(HEX);
      const [R, G, B] = [1, 3, 5].map((i) => parseInt(r.color.slice(i, i + 2), 16));
      expect(G > 1.6 * R && G > 1.6 * B, `${r.color} reads as green`).toBe(false);
    }
  });

  it('every role uses a different character', () => {
    const models = Object.values(config.roles).map((r) => r.character);
    expect(new Set(models).size).toBe(models.length);
    for (const m of models) expect(existsSync(`public/vendor/kenney-mini-characters/models/${m}.glb`), m).toBe(true);
  });

  it('the logo and mark files exist in public/', () => {
    for (const f of [config.brand.logo, config.brand.mark]) {
      expect(f.startsWith('/'), `${f} must start with /`).toBe(true);
      expect(existsSync('public' + f), `public${f} not found`).toBe(true);
    }
  });

  it('keeps an honest disclosure in both languages', () => {
    expect(config.disclosure.en).toMatch(/concept|simulat|illustrat|staged/i);
    expect(config.disclosure.ar).toMatch(/مفاهيمي|محاكا|مُحاكى|محاكى|توضيحي/);
  });
});
