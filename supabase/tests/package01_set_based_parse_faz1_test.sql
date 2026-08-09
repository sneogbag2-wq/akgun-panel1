begin;
select plan(9);

-- Setup test user and capabilities
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1','authenticated','authenticated','set-based-test@example.test','not-a-real-password',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',true);

insert into public.app_user_capabilities(user_id,capability)
select 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', capability
from unnest(array['import.create','import.validate','customer_master.view','customer_master.upload','stock.current.upload','sellout.upload']) capability;

create temporary table test_state(label text primary key, batch_id uuid);

-- 1. Test parse_customer_master_batch set-based execution
insert into test_state(label, batch_id)
select 'customer_master', (public.initiate_import_batch(
  'CUSTOMER_MASTER','test-customers.xlsx',100,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  repeat('1',64),'{}'::jsonb,'CUSTOMER_MASTER:test','test-cust-init',repeat('2',64)
)->>'batchId')::uuid;

select public.complete_import_upload((select batch_id from test_state where label='customer_master'), repeat('1',64), 100);

select is(
  (public.parse_customer_master_batch(
    (select batch_id from test_state where label='customer_master'),
    jsonb_build_array(
      jsonb_build_object('sheetName','Sheet1','sourceRowNumber',2,'rawCells','{"A":"50001"}'::jsonb,'rowHash',repeat('a',64),'parsedPayload','{"code":"50001"}'::jsonb,'parserWarnings','[]'::jsonb,'customerCodeCandidate','50001','customerCodeValid',true),
      jsonb_build_object('sheetName','Sheet1','sourceRowNumber',3,'rawCells','{"A":"50002"}'::jsonb,'rowHash',repeat('b',64),'parsedPayload','{"code":"50002"}'::jsonb,'parserWarnings','[]'::jsonb,'customerCodeCandidate','50002','customerCodeValid',true)
    ),
    'v1.0.0'
  )->>'readRowCount')::integer,
  2,
  'parse_customer_master_batch set-based execution parses 2 rows correctly'
);

select is(
  (select count(*)::integer from public.customer_master_row_observations where import_batch_id = (select batch_id from test_state where label='customer_master')),
  2,
  'customer_master_row_observations contains exactly 2 parsed rows'
);

-- 2. Test parse_current_stock_batch set-based execution
insert into public.product_variants(material_code) values('STOCK-MAT-1'),('STOCK-MAT-2');

insert into test_state(label, batch_id)
select 'current_stock', (public.initiate_import_batch(
  'CURRENT_STOCK_AVAILABLE','test-stock.xlsx',120,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  repeat('3',64),'{"warehouseCode":"DEFAULT_WAREHOUSE"}'::jsonb,'CURRENT_STOCK_AVAILABLE:test','test-stock-init',repeat('4',64)
)->>'batchId')::uuid;

select public.complete_import_upload((select batch_id from test_state where label='current_stock'), repeat('3',64), 120);

select is(
  (public.parse_current_stock_batch(
    (select batch_id from test_state where label='current_stock'),
    jsonb_build_array(
      jsonb_build_object('materialCode','STOCK-MAT-1','materialName','Stock Material 1','availableQuantity','10.5','sourceRef','{"sheetName":"Stock","rowNumber":2}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('c',64)),
      jsonb_build_object('materialCode','STOCK-MAT-2','materialName','Stock Material 2','availableQuantity','20.0','sourceRef','{"sheetName":"Stock","rowNumber":3}'::jsonb,'warnings','[]'::jsonb,'rowHash',repeat('d',64))
    ),
    'v1.0.0'
  )->>'readRowCount')::integer,
  2,
  'parse_current_stock_batch set-based execution parses 2 rows correctly'
);

select is(
  (select count(*)::integer from public.current_stock_staging_items where import_batch_id = (select batch_id from test_state where label='current_stock')),
  2,
  'current_stock_staging_items contains exactly 2 staging items'
);

-- 3. Test parse_sellout_batch set-based execution
insert into test_state(label, batch_id)
select 'sellout', (public.initiate_import_batch(
  'SELLOUT_TRADITIONAL','test-sellout.xlsx',150,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  repeat('5',64),'{}'::jsonb,'SELLOUT_TRADITIONAL:test','test-sellout-init',repeat('6',64)
)->>'batchId')::uuid;

select public.complete_import_upload((select batch_id from test_state where label='sellout'), repeat('5',64), 150);

select is(
  (public.parse_sellout_batch(
    (select batch_id from test_state where label='sellout'),
    jsonb_build_array(
      jsonb_build_object('sheetName','Sellout','sourceRowNumber','2','documentNo','DOC-100','customerCode','50001','materialCode','STOCK-MAT-1','materialName','Stock Material 1','billingDate','2026-08-01','quantity','5','litres','10','movementEvidence','EVID-1','rawPayload','{}'::jsonb,'rowSignature',repeat('e',64),'occurrenceOrdinal','1','warnings','[]'::jsonb),
      jsonb_build_object('sheetName','Sellout','sourceRowNumber','3','documentNo','DOC-101','customerCode','50002','materialCode','STOCK-MAT-2','materialName','Stock Material 2','billingDate','2026-08-01','quantity','8','litres','16','movementEvidence','EVID-2','rawPayload','{}'::jsonb,'rowSignature',repeat('f',64),'occurrenceOrdinal','1','warnings','[]'::jsonb)
    ),
    'v1.0.0'
  )->>'readRowCount')::integer,
  2,
  'parse_sellout_batch set-based execution parses 2 rows correctly'
);

select is(
  (select count(*)::integer from public.sellout_staging_rows where import_batch_id = (select batch_id from test_state where label='sellout')),
  2,
  'sellout_staging_rows contains exactly 2 staging rows'
);

-- 4. Test error handling on invalid rows
select throws_ok(
  format($$
    select public.parse_current_stock_batch(
      '%s'::uuid,
      jsonb_build_array(jsonb_build_object('materialCode','','materialName','Invalid','availableQuantity','not-a-number','rowHash','invalid-hash')),
      'v1.0.0'
    )
  $$, (select batch_id from test_state where label='current_stock')),
  '22023',
  'INVALID_CURRENT_STOCK_ROW',
  'parse_current_stock_batch throws INVALID_CURRENT_STOCK_ROW on invalid payload'
);

select throws_ok(
  format($$
    select public.parse_sellout_batch(
      '%s'::uuid,
      jsonb_build_array(jsonb_build_object('sheetName','','sourceRowNumber','1','rowSignature','invalid')),
      'v1.0.0'
    )
  $$, (select batch_id from test_state where label='sellout')),
  '22023',
  'INVALID_SELLOUT_ROW',
  'parse_sellout_batch throws INVALID_SELLOUT_ROW on invalid payload'
);

select * from finish();
rollback;
