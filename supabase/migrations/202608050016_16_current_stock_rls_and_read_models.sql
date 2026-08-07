-- Package 03A read models expose only the active set, never superseded item payload.

alter table public.warehouses enable row level security;
alter table public.current_stock_imports enable row level security;
alter table public.current_stock_staging_items enable row level security;
alter table public.current_stock_items enable row level security;
alter table public.current_stock_import_checks enable row level security;
alter table public.current_stock_freshness_policy_versions enable row level security;
alter table public.current_stock_publication_events enable row level security;

create or replace view public.current_stock_variant_v with (security_invoker=true) as
select i.id current_stock_import_id,i.as_of_at,c.material_code,c.material_name,c.available_quantity,c.quantity_uom,c.product_variant_id,c.product_family_id,c.product_litre_version_id,c.litres_per_stock_unit,
 case when c.litres_per_stock_unit is null then null else c.available_quantity*c.litres_per_stock_unit end variant_litres,c.resolution_state
from public.current_stock_imports i join public.current_stock_items c on c.current_stock_import_id=i.id where i.is_active;

create or replace view public.current_stock_family_v with (security_invoker=true) as
select current_stock_import_id,product_family_id,sum(variant_litres) filter(where variant_litres is not null) known_litres,
 case when bool_or(available_quantity>0 and (product_family_id is null or litres_per_stock_unit is null)) then null else sum(variant_litres) filter(where variant_litres is not null) end official_family_litres,
 count(*) filter(where available_quantity>0 and (product_family_id is null or litres_per_stock_unit is null)) exclusion_count
from public.current_stock_variant_v group by current_stock_import_id,product_family_id;

create or replace function public.current_stock_status_v2() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import public.current_stock_imports; v_policy public.current_stock_freshness_policy_versions; v_age numeric; v_state public.current_stock_freshness_state;
begin
 perform public.require_current_stock_capability('stock.current.view'); select * into v_import from public.current_stock_imports where is_active;
 if not found then return jsonb_build_object('freshness','NO_ACTIVE_STOCK'); end if;
 select * into v_policy from public.current_stock_freshness_policy_versions where effective_from<=now() and(effective_to is null or effective_to>now()) order by effective_from desc limit 1;
 v_age:=extract(epoch from(now()-v_import.as_of_at))/3600; v_state:=case when v_age<v_policy.fresh_under_hours then 'FRESH'::public.current_stock_freshness_state when v_age<v_policy.warning_under_hours then 'WARNING'::public.current_stock_freshness_state else 'STALE'::public.current_stock_freshness_state end;
 return jsonb_build_object('currentStockImportId',v_import.id,'asOfAt',v_import.as_of_at,'ageHours',public.current_stock_canonical_decimal(v_age),'freshness',v_state,'scope','DEFAULT_WAREHOUSE','controlTotals',v_import.control_totals);
end; $$;

create or replace function public.current_stock_variants_v2(p_query text default null,p_family_id uuid default null,p_resolution_state text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('materialCode',material_code,'materialName',material_name,'variantQuantity',public.current_stock_canonical_decimal(available_quantity),'quantityUom',quantity_uom,'productVariantId',product_variant_id,'productFamilyId',product_family_id,'variantLitres',case when variant_litres is null then null else public.current_stock_canonical_decimal(variant_litres) end,'resolutionState',resolution_state) order by material_code),'[]'::jsonb) from(select * from public.current_stock_variant_v where(p_query is null or material_code ilike '%'||p_query||'%' or material_name ilike '%'||p_query||'%')and(p_family_id is null or product_family_id=p_family_id)and(p_resolution_state is null or resolution_state::text=p_resolution_state) order by material_code offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_families_v2(p_query text default null,p_completeness text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('productFamilyId',product_family_id,'knownLitres',case when known_litres is null then null else public.current_stock_canonical_decimal(known_litres) end,'officialFamilyLitres',case when official_family_litres is null then null else public.current_stock_canonical_decimal(official_family_litres) end,'completeness',case when official_family_litres is null then 'PARTIAL' else 'COMPLETE' end,'exclusionCount',exclusion_count) order by product_family_id),'[]'::jsonb) from(select * from public.current_stock_family_v where(p_completeness is null or (p_completeness='COMPLETE' and official_family_litres is not null) or (p_completeness='PARTIAL' and official_family_litres is null))and(p_query is null or product_family_id::text ilike '%'||p_query||'%') order by product_family_id offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_exceptions_v2(p_code text default null,p_state text default null,p_page integer default 1,p_page_size integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.require_current_stock_capability('stock.current.view'); if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception 'INVALID_PAGINATION' using errcode='22023'; end if;
 return public.current_stock_status_v2() || jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('materialCode',material_code,'materialName',material_name,'variantQuantity',public.current_stock_canonical_decimal(available_quantity),'state',resolution_state,'exclusionReason',case when resolution_state='UNRESOLVED' then 'UNKNOWN_PRODUCT_VARIANT' else resolution_state::text end) order by material_code),'[]'::jsonb) from(select * from public.current_stock_variant_v where resolution_state<>'RESOLVED'and(p_code is null or material_code=p_code)and(p_state is null or resolution_state::text=p_state)order by material_code offset(p_page-1)*p_page_size limit p_page_size)x),'page',p_page,'pageSize',p_page_size);
end; $$;

create or replace function public.current_stock_reconciliation_v2(p_import_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import public.current_stock_imports;
begin
 perform public.require_current_stock_capability('stock.current.audit'); select * into v_import from public.current_stock_imports where id=coalesce(p_import_id,(select id from public.current_stock_imports where is_active)); if not found then raise exception 'CURRENT_STOCK_IMPORT_NOT_FOUND' using errcode='P0002'; end if;
 return jsonb_build_object('currentStockImportId',v_import.id,'isActive',v_import.is_active,'asOfAt',v_import.as_of_at,'controlTotals',v_import.control_totals,'itemCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id),'resolvedCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id and resolution_state='RESOLVED'),'exceptionCount',(select count(*) from public.current_stock_items where current_stock_import_id=v_import.id and resolution_state<>'RESOLVED'));
end; $$;

revoke all on public.current_stock_variant_v,public.current_stock_family_v from public,anon,authenticated;
revoke all on function public.require_current_stock_capability(text),public.parse_current_stock_batch(uuid,jsonb,text,text),public.validate_current_stock_batch(uuid,text),public.publish_current_stock(uuid,uuid,uuid,text,text,text),public.current_stock_status_v2(),public.current_stock_variants_v2(text,uuid,text,integer,integer),public.current_stock_families_v2(text,text,integer,integer),public.current_stock_exceptions_v2(text,text,integer,integer),public.current_stock_reconciliation_v2(uuid) from public,anon;
grant execute on function public.parse_current_stock_batch(uuid,jsonb,text,text),public.validate_current_stock_batch(uuid,text),public.publish_current_stock(uuid,uuid,uuid,text,text,text),public.current_stock_status_v2(),public.current_stock_variants_v2(text,uuid,text,integer,integer),public.current_stock_families_v2(text,text,integer,integer),public.current_stock_exceptions_v2(text,text,integer,integer),public.current_stock_reconciliation_v2(uuid) to authenticated;
