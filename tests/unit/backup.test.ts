import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
// Operational code runs in Node and remains outside the application bundle.
import { encryptStream, decryptedStream } from "../../scripts/ops/backup.mjs";
it("encrypts backup bytes and detects a changed archive or wrong recovery key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ejari-backup-test-"));
  try {
    const file = join(dir, "private.enc"),
      key = randomBytes(32),
      original = Buffer.from("private rental records");
    const result = await encryptStream(Readable.from(original), file, key);
    expect(result.bytes).toBe(original.length);
    expect((await readFile(file)).includes(original)).toBe(false);
    expect(await decryptedStream(file, key)).toEqual(original);
    await expect(decryptedStream(file, randomBytes(32))).rejects.toThrow();
    const changed = await readFile(file);
    changed[changed.length - 17] = (changed[changed.length - 17] ?? 0) ^ 1;
    await writeFile(file, changed);
    await expect(decryptedStream(file, key)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
