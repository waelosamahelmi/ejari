-- Phase 11: fast notification-center reads per user.
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
