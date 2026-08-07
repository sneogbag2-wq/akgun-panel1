-- Package 03: temporal non-overlap and append-only product history.

alter table public.product_family_membership_versions add constraint product_family_membership_no_overlap
  exclude using gist (product_variant_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.product_family_policy_versions add constraint product_family_policy_no_overlap
  exclude using gist (product_family_id with =, tstzrange(valid_from, valid_to, '[)') with &&);
alter table public.product_litre_versions add constraint product_litre_no_overlap
  exclude using gist (product_variant_id with =, tstzrange(valid_from, valid_to, '[)') with &&);

create or replace function public.prevent_product_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.product_resolution_write', true) is distinct from 'on' then
    raise exception 'PRODUCT_HISTORY_IMMUTABLE' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger product_membership_append_only before update or delete on public.product_family_membership_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_family_policy_append_only before update or delete on public.product_family_policy_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_litre_append_only before update or delete on public.product_litre_versions
for each row execute function public.prevent_product_history_mutation();
create trigger product_conversion_edges_append_only before update or delete on public.package_conversion_edge_versions
for each row execute function public.prevent_product_history_mutation();

create or replace function public.normalize_product_resolution_proposal_v2(p_proposal jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_kind text; v_valid_from timestamptz; v_key text; v_value text;
begin
  if jsonb_typeof(p_proposal) <> 'object' then raise exception 'INVALID_PRODUCT_RESOLUTION_PROPOSAL' using errcode = '22023'; end if;
  v_kind := p_proposal->>'resolutionKind';
  if v_kind not in ('FAMILY_MEMBERSHIP','FAMILY_POLICY','NON_VOLUME','LITRE_OVERRIDE') then raise exception 'INVALID_PRODUCT_RESOLUTION_KIND' using errcode = '22023'; end if;
  begin v_valid_from := (p_proposal->>'validFrom')::timestamptz; exception when others then raise exception 'INVALID_PRODUCT_RESOLUTION_EFFECTIVE_AT' using errcode = '22023'; end;
  if v_valid_from is null then raise exception 'INVALID_PRODUCT_RESOLUTION_EFFECTIVE_AT' using errcode = '22023'; end if;
  foreach v_key in array (case when v_kind in ('FAMILY_MEMBERSHIP','NON_VOLUME','LITRE_OVERRIDE') then array['productVariantId'] else array['productFamilyId'] end) loop
    v_value := p_proposal->>v_key;
    if v_value is null or not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
  end loop;
  if v_kind = 'FAMILY_MEMBERSHIP' then
    v_value := p_proposal->>'productFamilyId';
    if v_value is null or not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
  end if;
  if v_kind = 'FAMILY_POLICY' then
    if coalesce(p_proposal->>'canonicalStockVariantId',p_proposal->>'replenishmentVariantId') is null then raise exception 'PRODUCT_POLICY_VARIANT_REQUIRED' using errcode = '22023'; end if;
    foreach v_key in array array['canonicalStockVariantId','replenishmentVariantId'] loop
      v_value := p_proposal->>v_key;
      if v_value is not null and not (v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'INVALID_PRODUCT_RESOLUTION_REFERENCE' using errcode = '22023'; end if;
    end loop;
  end if;
  if v_kind = 'LITRE_OVERRIDE' then
    v_value := p_proposal->>'litresPerStockUnit';
    if v_value is null or not (v_value ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$') or v_value::numeric <= 0 then raise exception 'INVALID_PRODUCT_LITRE_OVERRIDE' using errcode = '22023'; end if;
    if jsonb_typeof(p_proposal->'evidence') <> 'array' or jsonb_array_length(p_proposal->'evidence') = 0 then raise exception 'PRODUCT_LITRE_EVIDENCE_REQUIRED' using errcode = '22023'; end if;
  end if;
  foreach v_key in array array['unitsPerCase','unitVolumeMl'] loop
    v_value := p_proposal->>v_key;
    if v_value is not null and (not (v_value ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$') or v_value::numeric <= 0) then raise exception 'INVALID_PRODUCT_DIMENSION' using errcode = '22023'; end if;
  end loop;
  if p_proposal ? 'quantityUom' and btrim(coalesce(p_proposal->>'quantityUom','')) = '' then raise exception 'INVALID_PRODUCT_QUANTITY_UOM' using errcode = '22023'; end if;
  return p_proposal || jsonb_build_object('resolutionKind',v_kind,'validFrom',v_valid_from::text);
end;
$$;

create or replace function public.product_resolution_preview_v2(p_issue_id uuid, p_proposal jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_issue public.product_resolution_issues; v_proposal jsonb; v_kind text; v_valid_from timestamptz; v_current jsonb := null;
begin
  perform public.require_product_capability('product.resolve');
  v_proposal := public.normalize_product_resolution_proposal_v2(p_proposal); v_kind := v_proposal->>'resolutionKind'; v_valid_from := (v_proposal->>'validFrom')::timestamptz;
  select * into v_issue from public.product_resolution_issues where id=p_issue_id for update;
  if not found then raise exception 'PRODUCT_RESOLUTION_ISSUE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_kind='FAMILY_MEMBERSHIP' then select to_jsonb(m) into v_current from public.product_family_membership_versions m where m.product_variant_id=(v_proposal->>'productVariantId')::uuid and m.valid_from<=v_valid_from and(m.valid_to is null or m.valid_to>v_valid_from) order by m.valid_from desc limit 1;
  elsif v_kind='FAMILY_POLICY' then select to_jsonb(p) into v_current from public.product_family_policy_versions p where p.product_family_id=(v_proposal->>'productFamilyId')::uuid and p.valid_from<=v_valid_from and(p.valid_to is null or p.valid_to>v_valid_from) order by p.valid_from desc limit 1;
  else select to_jsonb(l) into v_current from public.product_litre_versions l where l.product_variant_id=(v_proposal->>'productVariantId')::uuid and l.valid_from<=v_valid_from and(l.valid_to is null or l.valid_to>v_valid_from) order by l.valid_from desc limit 1;
  end if;
  return jsonb_build_object('issueId',v_issue.id,'issueCode',v_issue.issue_code,'state',v_issue.state,'proposal',v_proposal,'currentValue',v_current,'requiresBackdatedApproval',v_valid_from < transaction_timestamp(),
    'impact',jsonb_build_object('downstreamInvalidations',jsonb_build_array('SELLOUT','FKNS','CURRENT_STOCK','STOCK_PLANNING'),'computedNow',false));
end;
$$;

create or replace function public.commit_product_resolution_v2(p_issue_id uuid, p_proposal jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_issue public.product_resolution_issues; v_resolution public.product_manual_resolutions; v_proposal jsonb; v_kind text; v_valid_from timestamptz;
  v_variant uuid; v_family uuid; v_canonical uuid; v_replenishment uuid; v_new_version uuid; v_previous jsonb := '{}'::jsonb; v_new jsonb;
  v_membership public.product_family_membership_versions; v_policy public.product_family_policy_versions; v_litre public.product_litre_versions; v_valid_to timestamptz;
begin
  perform public.require_product_capability('product.resolve');
  if btrim(coalesce(p_reason,''))='' then raise exception 'INVALID_PRODUCT_RESOLUTION_COMMIT' using errcode='22023'; end if;
  v_proposal := public.normalize_product_resolution_proposal_v2(p_proposal); v_kind := v_proposal->>'resolutionKind'; v_valid_from := (v_proposal->>'validFrom')::timestamptz;
  if v_valid_from < transaction_timestamp() and v_proposal->>'backdatedApproval' is distinct from 'true' then raise exception 'BACKDATED_PRODUCT_RULE_REVIEW' using errcode='22023'; end if;
  select * into v_issue from public.product_resolution_issues where id=p_issue_id for update;
  if not found or v_issue.state <> 'OPEN' then raise exception 'PRODUCT_RESOLUTION_NOT_COMMITTABLE' using errcode='55000'; end if;
  perform set_config('app.product_resolution_write', 'on', true);
  if v_kind='FAMILY_MEMBERSHIP' then
    v_variant := (v_proposal->>'productVariantId')::uuid; v_family := (v_proposal->>'productFamilyId')::uuid;
    if not exists(select 1 from public.product_variants where product_variant_id=v_variant) or not exists(select 1 from public.product_families where product_family_id=v_family) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    select * into v_membership from public.product_family_membership_versions where product_variant_id=v_variant and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_membership.id is not null and v_membership.product_family_id=v_family then raise exception 'PRODUCT_RESOLUTION_NOOP' using errcode='22023'; end if;
    if v_membership.id is null and exists(select 1 from public.product_family_membership_versions where product_variant_id=v_variant and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to := v_membership.valid_to;
    if v_membership.id is not null then
      if v_membership.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorMembership',to_jsonb(v_membership)); update public.product_family_membership_versions set valid_to=v_valid_from where id=v_membership.id;
    end if;
    insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,valid_to,resolution_state,evidence,decision_source)
    values(v_variant,v_family,v_valid_from,v_valid_to,'RESOLVED',jsonb_build_array(jsonb_build_object('kind','MANUAL_APPROVED','issueId',p_issue_id)),'MANUAL') returning id into v_new_version;
    v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'productFamilyId',v_family);
  elsif v_kind='FAMILY_POLICY' then
    v_family := (v_proposal->>'productFamilyId')::uuid; v_canonical:=nullif(v_proposal->>'canonicalStockVariantId','')::uuid; v_replenishment:=nullif(v_proposal->>'replenishmentVariantId','')::uuid;
    if not exists(select 1 from public.product_families where product_family_id=v_family) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    if v_canonical is not null and not exists(select 1 from public.product_family_membership_versions where product_family_id=v_family and product_variant_id=v_canonical and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from)) then raise exception 'PRODUCT_POLICY_VARIANT_NOT_IN_FAMILY' using errcode='22023'; end if;
    if v_replenishment is not null and not exists(select 1 from public.product_family_membership_versions where product_family_id=v_family and product_variant_id=v_replenishment and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from)) then raise exception 'PRODUCT_POLICY_VARIANT_NOT_IN_FAMILY' using errcode='22023'; end if;
    select * into v_policy from public.product_family_policy_versions where product_family_id=v_family and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_policy.id is not null and v_policy.canonical_stock_variant_id is not distinct from v_canonical and v_policy.replenishment_variant_id is not distinct from v_replenishment then raise exception 'PRODUCT_RESOLUTION_NOOP' using errcode='22023'; end if;
    if v_policy.id is null and exists(select 1 from public.product_family_policy_versions where product_family_id=v_family and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to:=v_policy.valid_to;
    if v_policy.id is not null then
      if v_policy.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorPolicy',to_jsonb(v_policy)); update public.product_family_policy_versions set valid_to=v_valid_from where id=v_policy.id;
    end if;
    insert into public.product_family_policy_versions(product_family_id,canonical_stock_variant_id,replenishment_variant_id,valid_from,valid_to,decision_reason)
    values(v_family,v_canonical,v_replenishment,v_valid_from,v_valid_to,'MANUAL_APPROVED: '||p_reason) returning id into v_new_version;
    v_new:=jsonb_build_object('versionId',v_new_version,'productFamilyId',v_family,'canonicalStockVariantId',v_canonical,'replenishmentVariantId',v_replenishment);
  else
    v_variant:=(v_proposal->>'productVariantId')::uuid;
    if not exists(select 1 from public.product_variants where product_variant_id=v_variant) then raise exception 'PRODUCT_RESOLUTION_REFERENCE_NOT_FOUND' using errcode='P0002'; end if;
    select * into v_litre from public.product_litre_versions where product_variant_id=v_variant and valid_from<=v_valid_from and(valid_to is null or valid_to>v_valid_from) order by valid_from desc limit 1 for update;
    if v_litre.id is null and exists(select 1 from public.product_litre_versions where product_variant_id=v_variant and valid_from>v_valid_from) then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
    v_valid_to:=v_litre.valid_to;
    if v_litre.id is not null then
      if v_litre.valid_from=v_valid_from then raise exception 'PRODUCT_RESOLUTION_EFFECTIVE_AT_CONFLICT' using errcode='55000'; end if;
      v_previous:=jsonb_build_object('priorLitre',to_jsonb(v_litre)); update public.product_litre_versions set valid_to=v_valid_from where id=v_litre.id;
    end if;
    if v_kind='NON_VOLUME' then
      insert into public.product_litre_versions(product_variant_id,volume_tracked,valid_from,valid_to,selection_reason,evidence)
      values(v_variant,false,v_valid_from,v_valid_to,'MANUAL_NON_VOLUME: '||p_reason,jsonb_build_array(jsonb_build_object('kind','MANUAL_APPROVED','issueId',p_issue_id))) returning id into v_new_version;
      v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'volumeTracked',false);
    else
      insert into public.product_litre_versions(product_variant_id,litres_per_stock_unit,quantity_uom,units_per_case,unit_volume_ml,volume_tracked,valid_from,valid_to,selection_reason,evidence)
      values(v_variant,(v_proposal->>'litresPerStockUnit')::numeric,nullif(v_proposal->>'quantityUom',''),nullif(v_proposal->>'unitsPerCase','')::numeric,nullif(v_proposal->>'unitVolumeMl','')::numeric,true,v_valid_from,v_valid_to,'MANUAL_LITRE_OVERRIDE: '||p_reason,v_proposal->'evidence') returning id into v_new_version;
      v_new:=jsonb_build_object('versionId',v_new_version,'productVariantId',v_variant,'litresPerStockUnit',v_proposal->>'litresPerStockUnit');
    end if;
  end if;
  insert into public.product_manual_resolutions(product_resolution_issue_id,resolution_kind,status,reason,previous_value,new_value,impact_preview,created_by,committed_at)
  values(p_issue_id,v_kind,'COMMITTED',p_reason,v_previous,v_new,jsonb_build_object('downstreamInvalidations',jsonb_build_array('SELLOUT','FKNS','CURRENT_STOCK','STOCK_PLANNING'),'computedNow',false),auth.uid(),now()) returning * into v_resolution;
  update public.product_resolution_issues set state='RESOLVED',resolved_at=now(),resolved_by=auth.uid() where id=p_issue_id;
  return jsonb_build_object('resolutionId',v_resolution.id,'status',v_resolution.status,'issueId',p_issue_id,'restatementCandidate',true,'appliedVersionId',v_new_version);
end;
$$;

create or replace function public.revert_product_resolution_v2(p_resolution_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_resolution public.product_manual_resolutions; v_kind text; v_new_version uuid; v_prior jsonb; v_now timestamptz:=transaction_timestamp();
  v_membership public.product_family_membership_versions; v_policy public.product_family_policy_versions; v_litre public.product_litre_versions;
begin
  perform public.require_product_capability('product.resolve');
  if btrim(coalesce(p_reason,''))='' then raise exception 'PRODUCT_RESOLUTION_REVERT_REASON_REQUIRED' using errcode='22023'; end if;
  select * into v_resolution from public.product_manual_resolutions where id=p_resolution_id for update;
  if not found or v_resolution.status <> 'COMMITTED' then raise exception 'PRODUCT_RESOLUTION_NOT_REVERTIBLE' using errcode='55000'; end if;
  v_kind:=v_resolution.resolution_kind; v_new_version:=(v_resolution.new_value->>'versionId')::uuid;
  perform set_config('app.product_resolution_write', 'on', true);
  if v_kind='FAMILY_MEMBERSHIP' then
    select * into v_membership from public.product_family_membership_versions where id=v_new_version and valid_to is null for update;
    if not found or v_membership.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_family_membership_versions set valid_to=v_now where id=v_membership.id; v_prior:=v_resolution.previous_value->'priorMembership';
    if v_prior is not null then insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,resolution_state,evidence,decision_source)
      values((v_prior->>'product_variant_id')::uuid,(v_prior->>'product_family_id')::uuid,v_now,(v_prior->>'resolution_state')::public.product_resolution_state,v_prior->'evidence',(v_prior->>'decision_source')::public.product_evidence_kind); end if;
  elsif v_kind='FAMILY_POLICY' then
    select * into v_policy from public.product_family_policy_versions where id=v_new_version and valid_to is null for update;
    if not found or v_policy.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_family_policy_versions set valid_to=v_now where id=v_policy.id; v_prior:=v_resolution.previous_value->'priorPolicy';
    if v_prior is not null then insert into public.product_family_policy_versions(product_family_id,canonical_stock_variant_id,replenishment_variant_id,valid_from,decision_reason)
      values((v_prior->>'product_family_id')::uuid,nullif(v_prior->>'canonical_stock_variant_id','')::uuid,nullif(v_prior->>'replenishment_variant_id','')::uuid,v_now,v_prior->>'decision_reason'); end if;
  else
    select * into v_litre from public.product_litre_versions where id=v_new_version and valid_to is null for update;
    if not found or v_litre.valid_from>=v_now then raise exception 'PRODUCT_RESOLUTION_REVERT_CONFLICT' using errcode='55000'; end if;
    update public.product_litre_versions set valid_to=v_now where id=v_litre.id; v_prior:=v_resolution.previous_value->'priorLitre';
    if v_prior is not null then insert into public.product_litre_versions(product_variant_id,litres_per_stock_unit,quantity_uom,units_per_case,unit_volume_ml,volume_tracked,valid_from,selection_reason,evidence)
      values((v_prior->>'product_variant_id')::uuid,nullif(v_prior->>'litres_per_stock_unit','')::numeric,nullif(v_prior->>'quantity_uom',''),nullif(v_prior->>'units_per_case','')::numeric,nullif(v_prior->>'unit_volume_ml','')::numeric,(v_prior->>'volume_tracked')::boolean,v_now,v_prior->>'selection_reason',v_prior->'evidence'); end if;
  end if;
  update public.product_manual_resolutions set status='REVERTED',reverted_at=v_now,reverted_by=auth.uid(),revert_reason=p_reason where id=p_resolution_id;
  return jsonb_build_object('resolutionId',p_resolution_id,'status','REVERTED','reason',p_reason,'restatementCandidate',true);
end;
$$;
