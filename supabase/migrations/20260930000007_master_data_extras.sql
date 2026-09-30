-- Units: date the unit became available for rent (vacancy "since" when it never had a contract).
alter table public.units add column available_since date not null default current_date;
-- Per-user pinned (favorite) properties.
alter table public.user_settings add column pinned_property_ids uuid[] not null default '{}';
