begin;
select plan(20);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','authenticated','authenticated','package04-anonymous@example.test','not-a-real-password',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
insert into public.app_user_capabilities(user_id,capability)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',value from unnest(array['import.create','sellout.view','sellout.upload','sellout.validate','sellout.publish','sellout.audit','sellout.resolve','product.view']) value;

insert into public.customers(customer_code) values('5000001');
insert into public.product_variants(material_code) values('PRODUCT-6'),('PRODUCT-12');
insert into public.product_families(display_name,creation_reason) values('Anonymous Sellout Family','TEST');
insert into public.product_family_membership_versions(product_variant_id,product_family_id,valid_from,resolution_state,evidence,decision_source)
select product_variant_id,(select product_family_id from public.product_families where display_name='Anonymous Sellout Family'),'2025-01-01','RESOLVED','[]'::jsonb,'MANUAL' from public.product_variants where material_code in ('PRODUCT-6','PRODUCT-12');
insert into public.customer_status_versions(customer_id,valid_from,status,resolution_state)
select customer_id,'2025-01-01','ACTIVE','RESOLVED' from public.customers where customer_code='5000001';

select ok(exists(select 1 from public.source_contract_versions where source_kind='SELLOUT_TRADITIONAL' and publication_mode='UPSERT_VERSIONED'),'Sellout contract is overlap-versioned, not append-only');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='sellout_line_events' and column_name ilike '%amount%'),'Sellout event table contains no financial amount metric');
create temporary table package04_state(batch_id uuid,validation_run_id uuid);
insert into package04_state(batch_id) select (public.initiate_import_batch('SELLOUT_TRADITIONAL','anonymous-sellout.xlsx',99,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',repeat('a',64),'{"coverageFrom":"2025-02-01","coverageTo":"2025-02-28","coverageConfirmation":true}'::jsonb,'SELLOUT:2025-02','package04-init',repeat('b',64))->>'batchId')::uuid;
select public.complete_import_upload((select batch_id from package04_state),repeat('a',64),99);
select is((public.parse_sellout_batch((select batch_id from package04_state),jsonb_build_array(
 jsonb_build_object('sheetName','Sellout','sourceRowNumber',2,'documentNo','DOC-01','customerCode','5000001','materialCode','PRODUCT-6','billingDate','2025-02-03','quantity','2.5','litres','15','rawPayload','{}'::jsonb,'rowSignature',repeat('1',64),'occurrenceOrdinal',1,'warnings','[]'::jsonb),
 jsonb_build_object('sheetName','Sellout','sourceRowNumber',3,'documentNo','DOC-01','customerCode','5000001','materialCode','PRODUCT-12','billingDate','2025-02-03','quantity','-1','litres','-12','movementEvidence','PRODUCT_RETURN','rawPayload','{}'::jsonb,'rowSignature',repeat('2',64),'occurrenceOrdinal',1,'warnings','[]'::jsonb),
 jsonb_build_object('sheetName','Sellout','sourceRowNumber',4,'documentNo','DOC-02','customerCode','5000001','materialCode','PRODUCT-6','billingDate','2025-02-03','quantity','-1','litres','-6','rawPayload','{}'::jsonb,'rowSignature',repeat('3',64),'occurrenceOrdinal',1,'warnings','[]'::jsonb)
),'sellout-v2/1.0.0')->>'status'),'PARSED','six-column anonymous Sellout candidate parses');
select is((public.validate_sellout_batch((select batch_id from package04_state))->>'status'),'VALIDATED','valid signs and exact codes validate');
update package04_state set validation_run_id=(select active_validation_run_id from public.import_batches where id=batch_id);
select is((public.publish_sellout_overlap((select batch_id from package04_state),(select validation_run_id from package04_state),0,'package04-publish',repeat('c',64))->>'status'),'PUBLISHED','confirmed coverage publishes overlap-aware events');
select is((select count(*)::int from public.sellout_document_events where document_no='DOC-01'),1,'two product rows on the same invoice produce one document event');
select is((select count(*)::int from public.sellout_line_events where movement_type='POSITIVE_SALE'),1,'positive litre/quantity is a sale');
select is((select count(*)::int from public.sellout_line_events where movement_type='PRODUCT_RETURN'),1,'explicit return evidence is a product return');
select is((select count(*)::int from public.sellout_line_events where movement_type='UNCLASSIFIED_NEGATIVE'),1,'negative row without evidence remains unclassified');
select is((public.sellout_monthly_performance_v2('2025-02','2025-02-28','COMPANY',null)->>'netLitres'),'3','official net excludes the unclassified negative litre');
select is((public.sellout_resolution_preview_v2(jsonb_build_object('selloutLineEventId',(select e.id from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64)),'expectedVersionId',(select v.id from public.sellout_line_event_versions v join public.sellout_line_events e on e.id=v.sellout_line_event_id join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64) and v.is_current),'movementType','PRODUCT_RETURN','reason','anonymous evidence'))->>'proposedMovementType'),'PRODUCT_RETURN','manual resolution preview pins the current event version');
select is((public.commit_sellout_resolution_v2(jsonb_build_object('selloutLineEventId',(select e.id from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64)),'expectedVersionId',(select v.id from public.sellout_line_event_versions v join public.sellout_line_events e on e.id=v.sellout_line_event_id join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64) and v.is_current),'movementType','PRODUCT_RETURN','reason','anonymous evidence'),(public.sellout_resolution_preview_v2(jsonb_build_object('selloutLineEventId',(select e.id from public.sellout_line_events e join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64)),'expectedVersionId',(select v.id from public.sellout_line_event_versions v join public.sellout_line_events e on e.id=v.sellout_line_event_id join public.sellout_line_observations o on o.id=e.observation_id where o.row_signature=repeat('3',64) and v.is_current),'movementType','PRODUCT_RETURN','reason','anonymous evidence'))->>'previewHash'))->>'status'),'COMMITTED','manual resolution commits a new event version');
select is((public.sellout_monthly_performance_v2('2025-02','2025-02-28','COMPANY',null)->>'netLitres'),'-3','new event version recalculates the official net litre');
select is((public.reverse_sellout_resolution_v2((select id from public.sellout_manual_resolutions order by committed_at desc limit 1),'anonymous correction')->>'status'),'REVERSED','manual resolution reverse restores prior event version');
select is((public.sellout_periods_v2()->'items'->0->>'periodKey'),'2025-02','period catalogue uses year-qualified YYYY-MM');
select throws_ok($$select public.sellout_monthly_performance_v2('2',current_date,'COMPANY',null)$$,'22023','INVALID_SELLOUT_MONTH','month number without year is rejected');
select is((select count(*)::int from public.product_measurement_evidence where evidence_kind='SELLOUT'),1,'positive Sellout line alone feeds product measurement evidence');
select is((public.publish_sellout_overlap((select batch_id from package04_state),(select validation_run_id from package04_state),0,'package04-publish',repeat('c',64))->>'idempotentReplay')::boolean,true,'same idempotency request replays rather than duplicating events');
select is((select count(*)::int from public.sellout_line_observations),3,'multiset observations retain distinct legitimate source lines');
select is(has_table_privilege('anon','public.sellout_line_observations','select'),false,'anonymous role cannot read raw Sellout observations');
select * from finish();
rollback;
