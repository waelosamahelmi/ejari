-- Kuwait address: governorate (المحافظة). Nullable for legacy rows; the app
-- schema requires it for newly created/edited properties.
alter table public.properties
  add column if not exists governorate text;
