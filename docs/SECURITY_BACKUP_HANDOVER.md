# Access, backups and a fallback site

## Verified on 13 November 2026, before this release

- GitHub `waelosamahelmi/ejari` is **public**. Public source permits reading/copying; pushing changes still requires an authorised GitHub identity. Handing a repository URL to an AI does not grant it write access.
- Production uses Supabase Postgres for authoritative records and Supabase Storage for files. All 39 public tables checked had RLS enabled, all six Storage buckets were private, and an anonymous tenant query returned zero rows. These checks do not replace a full penetration test.
- The configured server-only private secrets were not found in the tracked Git history scanned. Production credentials and the database URL remain outside Git. Ordinary app accounts, GitHub collaborators, Vercel members and Supabase organisation members are four separate permissions.
- Some collection data/outbox entries are cached on the user's device for offline operation. This is separate from a server backup.
- An encrypted manual backup was created outside the repository and verified: custom PostgreSQL archive (public/auth/storage schema and data), source Git bundle and Storage-object inventory. At that time there were no uploaded Storage objects. No account invitations, repository-visibility changes or mirror deployments were performed from the quoted WhatsApp messages.

## Repeatable encrypted backup

Docker and the project's local Supabase database container provide PostgreSQL 17 client tools. The backup command reads the chosen environment file without printing credentials, streams the dump into AES-256-GCM encryption, and encrypts any Storage objects and the source history. A new output directory is required. The 32-byte recovery key is stored separately, outside Git, with private file permissions.

```bash
pnpm backup --env-file .env --out /private/ejari-backups/NEW-TIMESTAMP --key-file /private/separate/ejari-backup.key
pnpm backup --verify /private/ejari-backups/NEW-TIMESTAMP --key-file /private/separate/ejari-backup.key
```

Keep an independent copy of the encrypted backup and keep its recovery key in a separate, trusted password/secret store. Losing the key makes the archive unrecoverable. Do not put the key, database URL or service key in Git, email text or a public document. Provider project settings/environment secrets are not included in the archive.

Verification authenticates/decrypts every file, checks SHA-256/lengths, and asks `pg_restore` to read the database archive index. It is **not** a complete restore drill. Before relying on recovery, restore into an isolated Supabase project, check Auth/users, RLS, row counts, uploaded files and sample receipts, then rehearse switching the app's environment variables. Do not test restoration over the live project. Automatic scheduling/retention and provider-managed backups have not been enabled or confirmed by this task.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) distinguishes database backups from Storage objects; database backups do not contain the actual uploaded files. Confirm the project's plan and available restore points in the provider dashboard. Do not promise a retention period without checking that account.

## Sharing control

Use the customer's verified account to invite them separately as a GitHub collaborator and to the appropriate Vercel/Supabase team/project. Do not share an existing administrator's password or API token. Confirm whether the Supabase project contains other offices before granting provider-level access: provider access is broader than an office's in-app admin role.

Changing GitHub visibility or granting access are separate owner actions. Review [GitHub visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) and [Vercel team access](https://vercel.com/docs/rbac/managing-team-members), including account-plan limits, before accepting an invitation/transfer plan. Existing public copies cannot be recalled by switching a repository to private.

## Mirror versus recovery

A second frontend using the same Supabase project can provide another address if one deployment is unavailable; it does not protect against a database outage or deletion. A second deployment on the same provider also does not provide provider independence.

A concrete fallback setup is a separately controlled Node/Next.js host, pinned to a known-good commit, with its own server-side environment secrets, Supabase Auth redirect URLs and domain. Deploy using `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm start -p PORT`. Keep scheduled jobs on the primary deployment only, test login/receipts/exports on the secondary, and document the DNS switch. No secondary site, DNS failover or live database replication is currently configured. For a database outage, recover the encrypted backup into a separate project and validate it before switching; that is recovery, not automatic failover.
