-- Ijari: private storage buckets (signed URLs only) and realtime publication.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('contracts', 'contracts', false, 20971520),
  ('receipts', 'receipts', false, 10485760),
  ('vouchers', 'vouchers', false, 10485760),
  ('documents', 'documents', false, 20971520),
  ('branding', 'branding', false, 5242880),
  ('media', 'media', false, 15728640)
on conflict (id) do nothing;

-- Object paths are "<org_id>/<entity>/<file>"; the first segment scopes access to org members.
create policy "org members read" on storage.objects for select to authenticated
  using (
    bucket_id in ('contracts','receipts','vouchers','documents','branding','media')
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );
create policy "staff upload" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('contracts','receipts','vouchers','documents','branding','media')
    and public.has_role(((storage.foldername(name))[1])::uuid, array['admin','accountant','collector']::public.member_role[])
  );
create policy "managers update" on storage.objects for update to authenticated
  using (public.is_manager(((storage.foldername(name))[1])::uuid));
create policy "managers delete" on storage.objects for delete to authenticated
  using (public.is_manager(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.payments;
