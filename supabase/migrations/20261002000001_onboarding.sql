-- Onboarding state for the first-run wizard (§ launch readiness):
-- when the guided tour was completed/skipped and when the activation checklist was dismissed.
alter table public.user_settings
  add column tour_done_at timestamptz,
  add column checklist_dismissed_at timestamptz;
