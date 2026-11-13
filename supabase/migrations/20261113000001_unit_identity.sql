drop index public.units_active_label_unique;
create unique index units_active_type_label on public.units(property_id,type,lower(btrim(label))) where active;
