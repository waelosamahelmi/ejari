import type { Readable } from "node:stream";
export function encryptStream(
  input: Readable,
  path: string,
  key: Buffer,
): Promise<{ bytes: number; sha256: string }>;
export function decryptedStream(path: string, key: Buffer): Promise<Buffer>;
export function main(argv?: string[]): Promise<unknown>;
