// Minimal type declarations for the Node built-ins used by tests (no @types/node installed — by policy).
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): { readUInt32LE(offset: number): number; subarray(a: number, b: number): { toString(enc: string): string } } & Uint8Array;
  export function readFileSync(path: string, enc: 'utf8'): string;
  export function readdirSync(path: string, opts?: { recursive?: boolean }): string[];
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:crypto' {
  export function createHash(alg: string): { update(data: Uint8Array | string): { digest(enc: 'hex'): string } };
}
