# Independent operation and ownership

Ejari is a normal Next.js + Supabase application. Operation does not require the original developer's computer or account. The client controls office data through an admin membership in Settings → Users; that is separate from ownership of hosting accounts.

## Office administration

- Keep at least one client-controlled email as an active admin. Admins manage staff invitations, property assignments, exports, billing preferences and templates.
- Use **collector** for entry-only staff: rent collection and posted expense entry, without modifying/deleting contracts or existing financial records.
- Assign explicit properties in Settings → Users → Allowed properties. An empty selection grants none; “All current and future properties” grants office-wide access. Admins always have office-wide access.
- Disable a member for temporary suspension, or remove the member to permanently revoke this office membership. Historical receipts retain their original collector and audit trail. Other offices/accounts are unaffected.
- Export the office's records from Settings → Export. Keep an independent backup policy for database and Storage files.

## Infrastructure ownership checklist

These are account-provider operations, not changes an application can perform by adding an email field:

1. GitHub: grant the client's account access to the repository, or transfer the repository into their own organisation. Retain the Git history and branch protections.
2. Vercel: add the client's account to the owning team, or transfer the project to their team. Preserve the Git deployment connection, domains, cron schedules and environment variables.
3. Supabase: add the client as an organisation owner, or transfer the project to the client's organisation. Preserve Auth configuration, redirect URLs, Storage buckets and backups.
4. Domain/DNS: ensure the client controls the registrar and DNS account for `ejarikw.com`.
5. Secrets: use provider-managed secret/environment settings, rotate credentials after a handover, and never put credentials in Git or an ordinary document.
6. Verify client sign-in, a collection, an expense, a printed document, exports and backups before removing the previous operator's infrastructure access.

The repository contains setup steps in README.md, migrations in `supabase/migrations`, domain rules in `docs/DOMAIN.md`, and change/validation records in `docs/PROGRESS.md`. Any developer with access to these accounts can operate and maintain the system. No account transfers or new invitations are silently performed by a code push.

## Deploying the November client changes

Apply the new migrations to the intended Supabase project **before** deploying the corresponding application commit:

- `20261109000001_client_workflows.sql`
- `20261109000002_property_access.sql`

Existing collectors start with no property access until an admin assigns their properties. Other existing memberships retain their previous scope. Existing leases, receipts and unit histories are preserved. Existing tenant nationality fields are not invented or backfilled; an edit requires selecting a nationality. Unit restructuring requires resolving live/draft leases first. Temporary discounts are separate adjustments and never rewrite the original contractual rent.
