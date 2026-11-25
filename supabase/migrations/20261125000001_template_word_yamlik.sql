-- Contract template wording: "يستغل" -> "يمتلك" in the opening recital, for new contracts only.
-- Version-preserving: each CURRENT default template (system or office) that still has the old phrase
-- gets a new version with the corrected preamble and the same clauses. The old version stays as an
-- inactive-default history row. Existing contracts keep their frozen text and their template_id.
-- Office defaults that word the recital differently do not match and are left alone. Re-running is a no-op.
begin;

create temp table tw_map on commit drop as
  select id as old_id, gen_random_uuid() as new_id
  from public.contract_templates
  where is_default and active and preamble like '%حيث إن الطرف الأول يستغل%';

insert into public.contract_templates
  (id, org_id, type, name, version, family_id, preamble, closing, is_default, active, created_by)
select m.new_id, t.org_id, t.type, t.name,
       (select max(f.version) from public.contract_templates f where f.family_id = t.family_id) + 1,
       t.family_id,
       replace(t.preamble, 'حيث إن الطرف الأول يستغل', 'حيث إن الطرف الأول يمتلك'),
       t.closing, true, true, t.created_by
from tw_map m join public.contract_templates t on t.id = m.old_id;

insert into public.template_clauses
  (org_id, template_id, position, key, body, condition, default_condition, optional, default_enabled, created_by)
select c.org_id, m.new_id, c.position, c.key, c.body, c.condition, c.default_condition,
       c.optional, c.default_enabled, c.created_by
from tw_map m join public.template_clauses c on c.template_id = m.old_id;

update public.contract_templates set is_default = false, updated_at = now()
where id in (select old_id from tw_map);

commit;
