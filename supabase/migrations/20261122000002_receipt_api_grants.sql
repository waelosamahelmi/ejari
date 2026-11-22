-- Explicit grants are required on hosted projects whose default privileges differ from local Supabase.
-- Clients read document/audit rows; writes are exclusively through the scoped definer RPCs.
revoke all on public.collection_receipts, public.document_prints, public.owner_document_sequences from anon, authenticated;
grant select on public.collection_receipts, public.document_prints to authenticated;
grant all on public.collection_receipts, public.document_prints, public.owner_document_sequences to service_role;
grant select on public.v_document_print_counts to service_role;
notify pgrst, 'reload schema';
