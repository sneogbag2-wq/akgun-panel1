begin;
select plan(20);

create temporary table package03a_state(label text primary key, batch_id uuid, validation_run_id uuid, current_import_id uuid);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','package03a-anonymous@example.test','not-a-real-password',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
insert into public.app_user_capabilities(user_id,capability) select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',capability from unnest(array['import.create','import.validate','stock.current.view','stock.current.upload','stock.current.validate','stock.current.publish','stock.current.audit']) capability;

select ok(exists(select 1 from public.source_contract_versions where source_kind='CURRENT_STOCK_AVAILABLE' and publication_mode='FULL_REPLACE'),'current-stock contract is a full replacement source');
select is((select count(*)::integer from public.warehouses where warehouse_code='DEFAULT_WAREHOUSE'),1,'only the default warehouse is seeded');
insert into public.product_variants(material_code) values('ANON-6'),('ANON-MISSING');
insert into public.product_families(display_name,creation_reason) values('Anonymous stock family','TEST');
insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,resolution_state,evidence,decision_source)
select product_variant_id,(select product_family_id from public.product_families where display_name='Anonymous stock family'),now()-interval '1 day','RESOLVED','[]'::jsonb,'MANUAL' from public.product_variants where material_code in ('ANON-6','ANON-MISSING');
insert into public.product_litre_versions(product_variant_id,litres_per_stock_unit,quantity_uom,volume_tracked,valid_from,selection_reason,evidence)
select product_variant_id,6,'CASE',true,now()-interval '1 day','ANONYMOUS_TEST','[]'::jsonb from public.product_variants where material_code='ANON-6';

insert into package03a_state(label,batch_id) select 'first',(public.initiate_import_batch('CURRENT_STOCK_AVAILABLE','anonymous-stock.xlsx',64,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',repeat('a',64),'{"warehouseCode":"DEFAULT_WAREHOUSE"}'::jsonb,'CURRENT_STOCK_AVAILABLE:anonymous','package03a-init',repeat('b',64))->>'batchId')::uuid;
select public.complete_import_upload((select batch_id from package03a_state where label='first'),repeat('a',64),64);
select is((public.parse_current_stock_batch((select batch_id from package03a_state where label='first'),jsonb_build_array(
 jsonb_build_object('materialCode','ANON-6','materialName','Anonymous six','availableQuantity','2.5','sourceRef','{"sheetName":"Stock","rowNumber":2}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('1',64)),
 jsonb_build_object('materialCode','ANON-MISSING','materialName','Anonymous missing','availableQuantity','4','sourceRef','{"sheetName":"Stock","rowNumber":3}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('2',64))
),'current-stock-v2/1.0.0')->>'status'),'PARSED','valid current stock rows parse without a movement ledger');
select is((public.validate_current_stock_batch((select batch_id from package03a_state where label='first'))->>'status'),'VALIDATED','unknown/missing-litre stock does not block full snapshot validation');
update package03a_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='first';
select is((select count(*)::integer from public.data_quality_issues where validation_run_id=(select validation_run_id from package03a_state where label='first') and message_key like 'STK_018%'), 0, 'first batch has no old snapshot, bypasses anomaly check');
select is((public.publish_current_stock((select batch_id from package03a_state where label='first'),(select validation_run_id from package03a_state where label='first'),null,'package03a-publish',repeat('3',64))->>'status'),'PUBLISHED_WITH_EXCEPTIONS','positive missing LPU publishes with coverage exception');
update package03a_state set current_import_id=(select id from public.current_stock_imports where is_active);
select is((select variant_litres from public.current_stock_variant_v where material_code='ANON-6'),15::numeric,'variant quantity is converted with exact decimal litre coefficient');
select is((select official_family_litres from public.current_stock_family_v where product_family_id=(select product_family_id from public.product_families where display_name='Anonymous stock family')),null::numeric,'positive missing LPU prevents an official family litre total');
select is((public.current_stock_families_v2(null,'PARTIAL',1,50)->'items'->0->>'completeness'),'PARTIAL','family endpoint exposes incomplete coverage rather than inventing an official litre');
select is((public.current_stock_exceptions_v2('ANON-MISSING','MISSING_LPU',1,50)->'items'->0->>'materialCode'),'ANON-MISSING','exception endpoint exposes missing-LPU variant without raw source payload');
select is((public.current_stock_status_v2()->>'freshness'),'FRESH','active stock exposes freshness from as-of timestamp');
select is((public.current_stock_variants_v2(null,null,null,1,50)->'items'->0->>'materialCode'),'ANON-6','variant read model is deterministic by material code');

insert into package03a_state(label,batch_id) select 'second',(public.initiate_import_batch('CURRENT_STOCK_AVAILABLE','anonymous-stock-2.xlsx',65,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',repeat('c',64),'{"warehouseCode":"DEFAULT_WAREHOUSE"}'::jsonb,'CURRENT_STOCK_AVAILABLE:anonymous','package03a-init-2',repeat('d',64))->>'batchId')::uuid;
select public.complete_import_upload((select batch_id from package03a_state where label='second'),repeat('c',64),65);
select public.parse_current_stock_batch((select batch_id from package03a_state where label='second'),jsonb_build_array(jsonb_build_object('materialCode','ANON-6','materialName','Anonymous six','availableQuantity','0','sourceRef','{"sheetName":"Stock","rowNumber":2}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('4',64))),'current-stock-v2/1.0.0');
select public.validate_current_stock_batch((select batch_id from package03a_state where label='second'));
update package03a_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='second';
select is((select count(*)::integer from public.data_quality_issues where validation_run_id=(select validation_run_id from package03a_state where label='second') and message_key='STK_018_ANOMALY_WARNING_ROW_COUNT'), 1, 'row count dropped from 2 to 1 (50%), exceeds 20% threshold');
select is((select count(*)::integer from public.data_quality_issues where validation_run_id=(select validation_run_id from package03a_state where label='second') and message_key='STK_018_ANOMALY_WARNING_LITRE'), 1, 'litre count dropped from 15 to 0 (100%), exceeds 30% threshold');
select is((public.publish_current_stock((select batch_id from package03a_state where label='second'),(select validation_run_id from package03a_state where label='second'),(select current_import_id from package03a_state where label='first'),'package03a-publish-2',repeat('5',64))->>'status'),'ACTIVE','second complete set replaces the first set');
select is((select count(*)::integer from public.current_stock_variant_v where material_code='ANON-MISSING'),0,'a code absent from the replacement file is not retained');
select is((select count(*)::integer from public.current_stock_imports where is_active),1,'concurrent/serial publication invariant is one active import');
select throws_ok($$select public.publish_current_stock((select batch_id from package03a_state where label='second'),(select validation_run_id from package03a_state where label='second'),null,'package03a-stale',repeat('6',64))$$,'P0001','STALE_VALIDATION_RUN','stale validation or already-published batch fails closed');
select is(has_table_privilege('anon','public.current_stock_items','select'),false,'anonymous role cannot read current stock items directly');

insert into package03a_state(label,batch_id) select 'third',(public.initiate_import_batch('CURRENT_STOCK_AVAILABLE','anonymous-stock-3.xlsx',66,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',repeat('e',64),'{"warehouseCode":"DEFAULT_WAREHOUSE"}'::jsonb,'CURRENT_STOCK_AVAILABLE:anonymous','package03a-init-3',repeat('f',64))->>'batchId')::uuid;
select public.complete_import_upload((select batch_id from package03a_state where label='third'),repeat('e',64),66);
select public.parse_current_stock_batch((select batch_id from package03a_state where label='third'),jsonb_build_array(jsonb_build_object('materialCode','ANON-6','materialName','Anonymous six','availableQuantity','0','sourceRef','{"sheetName":"Stock","rowNumber":2}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('7',64))),'current-stock-v2/1.0.0');
select public.validate_current_stock_batch((select batch_id from package03a_state where label='third'));
update package03a_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id) where label='third';
select is((select count(*)::integer from public.data_quality_issues where validation_run_id=(select validation_run_id from package03a_state where label='third') and message_key like 'STK_018_ANOMALY_WARNING%'), 0, 'third batch matches second batch exactly (0% diff), graceful handling of zero denominator');

select * from finish();
rollback;
