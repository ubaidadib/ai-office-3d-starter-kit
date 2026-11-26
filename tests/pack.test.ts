// Asset consolidation (A2/A13): merged pack matches its sources and the layout; originals preserved.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { USED_MODELS } from '../src/model/layout';

const cfg = JSON.parse(readFileSync('tools/furniture-pack.json', 'utf8'));
const man = JSON.parse(readFileSync(cfg.manifest, 'utf8'));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

function glbJson(p: string) {
  const b = readFileSync(p);
  expect(b.readUInt32LE(0)).toBe(0x46546c67);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

describe('furniture pack', () => {
  it('contains exactly the models the layout uses', () => {
    expect([...cfg.models].sort()).toEqual(USED_MODELS);
    expect(Object.keys(man.models).sort()).toEqual(USED_MODELS);
  });
  it('records the SHA-256 of every source file, and the sources are unchanged', () => {
    for (const [name, m] of Object.entries<{ source_file: string; source_sha256: string }>(man.models)) {
      expect(sha(m.source_file), name).toBe(m.source_sha256);
    }
  });
  it('the output file matches its manifest checksum', () => {
    expect(sha(cfg.output)).toBe(man.output_sha256);
  });
  it('shares materials: far fewer materials than source files, no unlit extension', () => {
    const j = glbJson(cfg.output);
    expect(j.materials.length).toBe(man.material_count);
    expect(j.materials.length).toBeLessThanOrEqual(16);
    expect(j.extensionsUsed ?? []).not.toContain('KHR_materials_unlit');
    expect(j.buffers.length).toBe(1);
    expect(j.scenes[0].nodes.length).toBe(USED_MODELS.length);
    const names = j.scenes[0].nodes.map((i: number) => j.nodes[i].name).sort();
    expect(names).toEqual(USED_MODELS);
  });
  it('every original Kenney file and licence is still present', () => {
    const files = readdirSync('public/vendor/kenney-furniture-kit/models').filter((f) => f.endsWith('.glb'));
    expect(files.length).toBe(140);
    expect(readFileSync('public/vendor/kenney-furniture-kit/License.txt', 'utf8')).toContain('CC0');
    expect(readFileSync('public/vendor/kenney-mini-characters/License.txt', 'utf8')).toContain('CC0');
  });
});
