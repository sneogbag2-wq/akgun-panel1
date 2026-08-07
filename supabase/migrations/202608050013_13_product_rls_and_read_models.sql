-- Package 03: fail-closed product reads.  Provenance is audit-only.

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'product_variants','product_variant_names','product_families','product_family_membership_versions',
    'product_family_policy_versions','package_conversion_observations','package_conversion_edge_versions',
    'product_measurement_evidence','product_litre_candidates','product_litre_versions','product_resolution_runs',
    'product_resolution_issues','product_manual_resolutions'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on table public.%I from anon, authenticated',v_table);
  end loop;
end;
$$;

grant select on public.product_variants, public.product_families, public.product_family_membership_versions,
  public.product_family_policy_versions, public.package_conversion_edge_versions, public.product_litre_versions,
  public.product_resolution_runs, public.product_resolution_issues to authenticated;

create policy product_variants_view on public.product_variants for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_families_view on public.product_families for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_memberships_view on public.product_family_membership_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_policy_view on public.product_family_policy_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy package_edges_view on public.package_conversion_edge_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_litre_view on public.product_litre_versions for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_runs_view on public.product_resolution_runs for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_issues_view on public.product_resolution_issues for select to authenticated using (public.has_capability(auth.uid(),'product.view'));
create policy product_names_audit on public.product_variant_names for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy package_observations_audit on public.package_conversion_observations for select to authenticated using (public.has_capability(auth.uid(),'product.audit') and public.has_capability(auth.uid(),'import.audit'));
create policy product_measurement_audit on public.product_measurement_evidence for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy product_candidates_audit on public.product_litre_candidates for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));
create policy product_manual_audit on public.product_manual_resolutions for select to authenticated using (public.has_capability(auth.uid(),'product.audit'));

create or replace function public.product_canonical_decimal_text_v2(p_value numeric)
returns text language sql immutable set search_path = '' as $$
  select case when p_value is null then null else trim(trailing '.' from trim(trailing '0' from p_value::text)) end;
$$;

create or replace function public.product_read_context_v2(p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.product_resolution_runs;
begin
  perform public.require_product_capability('product.view');
  select * into v_run from public.product_resolution_runs where status in ('SUCCEEDED','SUCCEEDED_WITH_EXCEPTIONS') order by finished_at desc nulls last, id desc limit 1;
  return jsonb_build_object('asOf',p_as_of,'resolutionRun',case when v_run.id is null then null else jsonb_build_object('id',v_run.id,'ruleVersion',v_run.rule_version,'status',v_run.status,'coverage',v_run.coverage,'resultHash',v_run.result_hash) end,
    'exclusions',jsonb_build_object('unresolvedVariants',(select count(*) from public.product_resolution_issues where state='OPEN')));
end;
$$;

create or replace function public.product_variants_list_v2(
  p_query text default null, p_family_id uuid default null, p_conversion_status text default null, p_as_of timestamptz default now(), p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_items jsonb;
begin
  perform public.require_product_capability('product.view');
  if p_page < 1 or p_page_size < 1 or p_page_size > 100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  select coalesce(jsonb_agg(item order by item->>'materialCode'),'[]'::jsonb) into v_items from (
    select jsonb_build_object('productVariantId',v.product_variant_id,'materialCode',v.material_code,'volumeTracked',v.volume_tracked,
      'familyId',m.product_family_id,'membershipVersionId',m.id,'membershipState',m.resolution_state,
      'litresPerStockUnit',public.product_canonical_decimal_text_v2(l.litres_per_stock_unit),'litreVersionId',l.id,'litreCoverage',case when l.id is null then 'MISSING_LITRE_ANCHOR' else 'AVAILABLE' end) item
    from public.product_variants v
    left join lateral (select * from public.product_family_membership_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1) m on true
    left join lateral (select * from public.product_litre_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1) l on true
    where (p_query is null or v.material_code ilike '%'||p_query||'%') and (p_family_id is null or m.product_family_id=p_family_id)
      and (p_conversion_status is null or m.resolution_state::text=p_conversion_status)
    order by v.material_code offset (p_page-1)*p_page_size limit p_page_size
  ) rows;
  return v_context || jsonb_build_object('items',v_items,'page',p_page,'pageSize',p_page_size);
end;
$$;

create or replace function public.product_families_list_v2(
  p_as_of timestamptz default now(), p_resolution_state text default null, p_volume_status text default null, p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_items jsonb;
begin
  perform public.require_product_capability('product.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  select coalesce(jsonb_agg(item order by item->>'displayName'),'[]'::jsonb) into v_items from (
    select jsonb_build_object('productFamilyId',f.product_family_id,'displayName',f.display_name,'lifecycleState',f.lifecycle_state,
      'memberCount',(select count(*) from public.product_family_membership_versions m where m.product_family_id=f.product_family_id and m.valid_from<=p_as_of and (m.valid_to is null or m.valid_to>p_as_of)),
      'canonicalStockVariantId',pol.canonical_stock_variant_id,'replenishmentVariantId',pol.replenishment_variant_id) item
    from public.product_families f left join lateral (select * from public.product_family_policy_versions p where p.product_family_id=f.product_family_id and p.valid_from<=p_as_of and (p.valid_to is null or p.valid_to>p_as_of) order by p.valid_from desc limit 1) pol on true
    where (p_resolution_state is null or exists(select 1 from public.product_family_membership_versions m where m.product_family_id=f.product_family_id and m.resolution_state::text=p_resolution_state and m.valid_from<=p_as_of and (m.valid_to is null or m.valid_to>p_as_of)))
    order by f.display_name offset (p_page-1)*p_page_size limit p_page_size
  ) rows;
  return v_context || jsonb_build_object('items',v_items,'page',p_page,'pageSize',p_page_size,'volumeStatusFilter',p_volume_status);
end;
$$;

create or replace function public.product_family_detail_v2(p_family_id uuid, p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_context jsonb; v_family public.product_families;
begin
  perform public.require_product_capability('product.view'); select * into v_family from public.product_families where product_family_id=p_family_id;
  if not found then raise exception 'PRODUCT_FAMILY_NOT_FOUND' using errcode='P0002'; end if;
  v_context:=public.product_read_context_v2(p_as_of);
  return v_context || jsonb_build_object('productFamilyId',v_family.product_family_id,'displayName',v_family.display_name,'lifecycleState',v_family.lifecycle_state,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('productVariantId',v.product_variant_id,'materialCode',v.material_code,'membershipVersionId',m.id,'membershipState',m.resolution_state,'litresPerStockUnit',public.product_canonical_decimal_text_v2(l.litres_per_stock_unit)) order by v.material_code),'[]'::jsonb)
      from public.product_family_membership_versions m join public.product_variants v on v.product_variant_id=m.product_variant_id left join lateral(select * from public.product_litre_versions x where x.product_variant_id=v.product_variant_id and x.valid_from<=p_as_of and (x.valid_to is null or x.valid_to>p_as_of) order by x.valid_from desc limit 1)l on true where m.product_family_id=p_family_id and m.valid_from<=p_as_of and(m.valid_to is null or m.valid_to>p_as_of)),
    'policy',(select jsonb_build_object('canonicalStockVariantId',p.canonical_stock_variant_id,'replenishmentVariantId',p.replenishment_variant_id,'versionId',p.id) from public.product_family_policy_versions p where p.product_family_id=p_family_id and p.valid_from<=p_as_of and(p.valid_to is null or p.valid_to>p_as_of) order by p.valid_from desc limit 1));
end;
$$;

create or replace function public.product_conversion_graph_v2(p_family_id uuid, p_as_of timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view');
  return public.product_read_context_v2(p_as_of) || jsonb_build_object('productFamilyId',p_family_id,'edges',(
    select coalesce(jsonb_agg(jsonb_build_object('edgeId',e.id,'sourceVariantId',e.source_product_variant_id,'targetVariantId',e.target_product_variant_id,'targetUnitsPerSourceUnit',public.product_canonical_decimal_text_v2(e.target_units_per_source_unit),'resolutionState',e.resolution_state) order by e.id),'[]'::jsonb)
    from public.package_conversion_edge_versions e where e.valid_from<=p_as_of and(e.valid_to is null or e.valid_to>p_as_of) and exists(select 1 from public.product_family_membership_versions m where m.product_family_id=p_family_id and m.product_variant_id in(e.source_product_variant_id,e.target_product_variant_id) and m.valid_from<=p_as_of and(m.valid_to is null or m.valid_to>p_as_of))));
end;
$$;

create or replace function public.product_litre_coverage_v2(p_as_of timestamptz default now(), p_source_kind text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view');
  return public.product_read_context_v2(p_as_of) || jsonb_build_object('sourceKind',p_source_kind,'variantCount',(select count(*) from public.product_variants),'withOfficialLitreCount',(select count(distinct product_variant_id) from public.product_litre_versions where valid_from<=p_as_of and(valid_to is null or valid_to>p_as_of)));
end;
$$;

create or replace function public.product_exceptions_list_v2(p_code text default null,p_state text default null,p_family_id uuid default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_product_capability('product.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
  return public.product_read_context_v2(now()) || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('issueId',i.id,'issueCode',i.issue_code,'state',i.state,'productFamilyId',i.product_family_id,'productVariantId',i.product_variant_id) order by i.created_at,i.id),'[]'::jsonb) from (select * from public.product_resolution_issues where(p_code is null or issue_code=p_code)and(p_state is null or state=p_state)and(p_family_id is null or product_family_id=p_family_id) order by created_at,id offset(p_page-1)*p_page_size limit p_page_size)i),'page',p_page,'pageSize',p_page_size);
end;
$$;

create or replace function public.product_resolution_reconciliation_v2(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.product_resolution_runs;
begin
  perform public.require_product_capability('product.audit'); select * into v_run from public.product_resolution_runs where id=p_run_id;
  if not found then raise exception 'PRODUCT_RESOLUTION_RUN_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object('runId',v_run.id,'ruleVersion',v_run.rule_version,'status',v_run.status,'componentSummary',v_run.component_summary,'coverage',v_run.coverage,'resultHash',v_run.result_hash,'issueSummary',(select coalesce(jsonb_object_agg(issue_code,count),'{}'::jsonb) from(select issue_code,count(*)::integer count from public.product_resolution_issues where product_resolution_run_id=p_run_id group by issue_code)s));
end;
$$;

revoke all on function public.require_product_capability(text) from public, anon;
revoke all on function public.product_read_context_v2(timestamptz) from public, anon;
revoke all on function public.product_variants_list_v2(text,uuid,text,timestamptz,integer,integer) from public, anon;
revoke all on function public.product_families_list_v2(timestamptz,text,text,integer,integer) from public, anon;
revoke all on function public.product_family_detail_v2(uuid,timestamptz) from public, anon;
revoke all on function public.product_conversion_graph_v2(uuid,timestamptz) from public, anon;
revoke all on function public.product_litre_coverage_v2(timestamptz,text) from public, anon;
revoke all on function public.product_exceptions_list_v2(text,text,uuid,integer,integer) from public, anon;
revoke all on function public.product_resolution_reconciliation_v2(uuid) from public, anon;
revoke all on function public.normalize_product_resolution_proposal_v2(jsonb) from public, anon;
revoke all on function public.product_canonical_decimal_text_v2(numeric) from public, anon;
revoke all on function public.parse_package_conversion_batch(uuid,jsonb,text,text) from public, anon;
revoke all on function public.validate_package_conversion_batch(uuid,text,jsonb) from public, anon;
revoke all on function public.publish_package_conversion_batch(uuid,uuid,integer,text,text,text) from public, anon;
revoke all on function public.product_resolution_preview_v2(uuid,jsonb) from public, anon;
revoke all on function public.commit_product_resolution_v2(uuid,jsonb,text) from public, anon;
revoke all on function public.revert_product_resolution_v2(uuid,text) from public, anon;
grant execute on function public.parse_package_conversion_batch(uuid,jsonb,text,text), public.validate_package_conversion_batch(uuid,text,jsonb), public.publish_package_conversion_batch(uuid,uuid,integer,text,text,text), public.product_resolution_preview_v2(uuid,jsonb), public.commit_product_resolution_v2(uuid,jsonb,text), public.revert_product_resolution_v2(uuid,text) to authenticated;
grant execute on function public.product_read_context_v2(timestamptz), public.product_variants_list_v2(text,uuid,text,timestamptz,integer,integer), public.product_families_list_v2(timestamptz,text,text,integer,integer), public.product_family_detail_v2(uuid,timestamptz), public.product_conversion_graph_v2(uuid,timestamptz), public.product_litre_coverage_v2(timestamptz,text), public.product_exceptions_list_v2(text,text,uuid,integer,integer), public.product_resolution_reconciliation_v2(uuid) to authenticated;
