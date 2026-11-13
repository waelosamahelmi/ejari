import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { resolve, dirname, join, sep } from "node:path";
import { spawn } from "node:child_process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
const MAGIC = Buffer.from("EJARI-BACKUP-1\n");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function processResult(child) {
  return new Promise((yes, no) => {
    let error = "";
    child.stderr?.on("data", (b) => {
      error += b;
    });
    child.on("error", no);
    child.on("close", (code) =>
      code === 0 ? yes() : no(new Error(`Backup tool failed (${code}): ${error.slice(0, 300)}`)),
    );
  });
}
export async function encryptStream(input, path, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    hash = createHash("sha256");
  let bytes = 0;
  await writeFile(path, Buffer.concat([MAGIC, iv]), { mode: 0o600, flag: "wx" });
  const tap = new Transform({
    transform(chunk, _, cb) {
      bytes += chunk.length;
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  await pipeline(input, tap, cipher, createWriteStream(path, { flags: "a", mode: 0o600 }));
  await appendFile(path, cipher.getAuthTag());
  return { bytes, sha256: hash.digest("hex") };
}
export async function decryptedStream(path, key) {
  const f = await readFile(path); // Dumps are streamed on creation; verification decrypts each encrypted file separately.
  if (f.length < MAGIC.length + 28 || !f.subarray(0, MAGIC.length).equals(MAGIC))
    throw Error("Invalid backup header");
  const d = createDecipheriv("aes-256-gcm", key, f.subarray(MAGIC.length, MAGIC.length + 12));
  d.setAuthTag(f.subarray(-16));
  return Buffer.concat([d.update(f.subarray(MAGIC.length + 12, -16)), d.final()]);
}
async function keyAt(path, create = false) {
  try {
    const key = await readFile(path);
    if (key.length !== 32) throw Error("Backup key must be 32 bytes");
    return key;
  } catch (e) {
    if (e.code !== "ENOENT" || !create) throw e;
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const key = randomBytes(32);
    await writeFile(path, key, { mode: 0o600, flag: "wx" });
    return key;
  }
}
function outsideRepo(path) {
  if (path === root || path.startsWith(root + sep))
    throw Error("Keep backups and encryption keys outside the repository");
}
async function verify(dir, key, container) {
  const manifest = JSON.parse((await decryptedStream(join(dir, "manifest.enc"), key)).toString());
  for (const file of manifest.files) {
    const path = resolve(dir, file.path);
    if (!path.startsWith(resolve(dir) + sep)) throw Error("Unsafe backup path");
    const bytes = await decryptedStream(path, key);
    if (
      bytes.length !== file.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      throw Error("Backup checksum mismatch");
  }
  const dump = await decryptedStream(join(dir, "database.dump.enc"), key);
  if (!dump.subarray(0, 5).equals(Buffer.from("PGDMP")))
    throw Error("Database archive is not a pg_dump custom archive");
  const child = spawn("docker", ["exec", "-i", container, "pg_restore", "--list"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let toc = "";
  child.stdout.on("data", (b) => {
    toc += b;
  });
  const done = processResult(child);
  child.stdin.on("error", (e) => {
    if (e.code !== "EPIPE") throw e;
  });
  child.stdin.end(dump);
  await done;
  if (!toc.includes("TABLE DATA")) throw Error("Database archive contains no table data");
  console.log(
    JSON.stringify({
      verified: true,
      encryptedFiles: manifest.files.length,
      storageObjects: manifest.storageObjects,
      tableDataEntries: toc.split("\n").filter((l) => l.includes("TABLE DATA")).length,
      directory: dir,
    }),
  );
  return manifest;
}
export async function main(argv = process.argv.slice(2)) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i < 0 ? undefined : argv[i + 1];
  };
  const keyFile = arg("--key-file"),
    out = arg("--out"),
    check = arg("--verify"),
    container = arg("--container") ?? "supabase_db_ijari";
  if (!keyFile || (!out && !check))
    throw Error(
      "Usage: node scripts/ops/backup.mjs --env-file .env --out /private/backup-dir --key-file /private/separate.key [--container supabase_db_ijari]; verify with --verify /private/backup-dir --key-file /private/separate.key",
    );
  const keyPath = resolve(keyFile);
  outsideRepo(keyPath);
  const destination = resolve(check ?? out);
  outsideRepo(destination);
  const key = await keyAt(keyPath, !check);
  if (check) return verify(destination, key, container);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await mkdir(destination, { mode: 0o700 }); // Must be a new directory; never overwrite a previous backup.
  const cfg = parse(await readFile(resolve(arg("--env-file") ?? ".env")));
  const connection = cfg.PROD_DATABASE_URL ?? cfg.DATABASE_URL;
  if (!connection || !cfg.NEXT_PUBLIC_SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Missing database or Storage configuration");
  const u = new URL(connection),
    local = ["localhost", "127.0.0.1"].includes(u.hostname);
  const env = {
    ...process.env,
    PGHOST: local ? "127.0.0.1" : u.hostname,
    PGPORT: local ? "5432" : u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1) || "postgres",
    PGSSLMODE: local ? "disable" : "require",
  };
  const dump = spawn(
    "docker",
    [
      "exec",
      ...["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"].flatMap((k) => [
        "-e",
        k,
      ]),
      container,
      "pg_dump",
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--schema=auth",
      "--schema=storage",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  const done = processResult(dump);
  const encrypted = await encryptStream(dump.stdout, join(destination, "database.dump.enc"), key);
  await done;
  const files = [{ path: "database.dump.enc", ...encrypted }];
  const git = spawn("git", ["bundle", "create", "-", "--all"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const gitDone = processResult(git);
  const source = await encryptStream(git.stdout, join(destination, "source.bundle.enc"), key);
  await gitDone;
  files.push({ path: "source.bundle.enc", ...source });
  const client = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw buckets.error;
  await mkdir(join(destination, "storage"), { mode: 0o700 });
  let count = 0;
  for (const bucket of buckets.data) {
    const prefixes = [""];
    for (let index = 0; index < prefixes.length; index++) {
      const prefix = prefixes[index];
      let offset = 0;
      for (;;) {
        const listed = await client.storage
          .from(bucket.id)
          .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
        if (listed.error) throw listed.error;
        for (const entry of listed.data) {
          const name = prefix ? prefix + "/" + entry.name : entry.name;
          if (!entry.id) {
            prefixes.push(name);
            continue;
          }
          const object = await client.storage.from(bucket.id).download(name);
          if (object.error) throw object.error;
          const bytes = Buffer.from(await object.data.arrayBuffer());
          if (typeof entry.metadata?.size === "number" && entry.metadata.size !== bytes.length)
            throw Error("Storage changed during backup; retry in a new directory");
          const path =
            "storage/" +
            createHash("sha256")
              .update(bucket.id + "/" + name)
              .digest("hex") +
            ".enc";
          files.push({
            path,
            bucket: bucket.id,
            object: name,
            ...(await encryptStream(Readable.from(bytes), join(destination, path), key)),
          });
          count++;
        }
        if (listed.data.length < 100) break;
        offset += 100;
      }
    }
  }
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    project: new URL(cfg.NEXT_PUBLIC_SUPABASE_URL).hostname,
    storageObjects: count,
    files,
    scope:
      "public/auth/storage schema and data, source history and Storage objects; provider settings and environment secrets are not included",
  };
  await encryptStream(
    Readable.from(Buffer.from(JSON.stringify(manifest, null, 2))),
    join(destination, "manifest.enc"),
    key,
  );
  await verify(destination, key, container);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
