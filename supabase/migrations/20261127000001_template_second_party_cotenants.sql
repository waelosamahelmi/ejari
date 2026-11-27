-- Contract template wording: additional tenants are written as part of the second party
-- ("الطرف الثاني: A، بطاقة مدنية: X؛ وB، بطاقة مدنية: Y") instead of under a "المستأجرون الإضافيون" label.
-- New contracts only. Version-preserving, same pattern as 20261125000001: each CURRENT default template
-- that still has the old line gets a new version; the old version stays as inactive history.
-- Existing contracts keep their frozen text and template_id. Re-running is a no-op.
begin;

create temp table tw_map on commit drop as
  select id as old_id, gen_random_uuid() as new_id
  from public.contract_templates
  where is_default and active and preamble like '%المستأجرون الإضافيون: {{co_tenants}}%';

insert into public.contract_templates
  (id, org_id, type, name, version, family_id, preamble, closing, is_default, active, created_by)
select m.new_id, t.org_id, t.type, t.name,
       (select max(f.version) from public.contract_templates f where f.family_id = t.family_id) + 1,
       t.family_id,
       replace(t.preamble, 'المستأجرون الإضافيون: {{co_tenants}}', 'و{{co_tenants}}'),
       t.closing, true, true, t.created_by
from tw_map m join public.contract_templates t on t.id = m.old_id;

insert into public.template_clauses
  (org_id, template_id, position, key, body, condition, default_condition, optional, default_enabled, created_by)
select c.org_id, m.new_id, c.position, c.key, c.body, c.condition, c.default_condition,
       c.optional, c.default_enabled, c.created_by
from tw_map m join public.template_clauses c on c.template_id = m.old_id;

-- Clause 7 (utilities): when the first party bears utilities, add the no-waste condition. New versions only.
update public.template_clauses set body = replace(body, 'من حساب {{utilities_party_label}} وحده.', 'من حساب {{utilities_party_label}} وحده{{#utilities_owner}} بشرط عدم الإسراف أو سوء استخدام الكهرباء والماء{{/utilities_owner}}.')
where key = 'utilities' and template_id in (select new_id from tw_map) and body like '%من حساب {{utilities_party_label}} وحده.%' and body not like '%بشرط عدم الإسراف%';

update public.contract_templates set is_default = false, updated_at = now()
where id in (select old_id from tw_map);

commit;
