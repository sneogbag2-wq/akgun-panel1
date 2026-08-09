begin;
select plan(4);

-- Setup test user and capabilities
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2','authenticated','authenticated','sales-invoice-test@example.test','not-a-real-password',now(),'{}','{}',now(),now());
select set_config('request.jwt.claim.sub','b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',true);

insert into public.app_user_capabilities(user_id,capability)
select 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', capability
from unnest(array['import.create','import.validate','invoice.upload','invoice.validate','invoice.publish']) capability;

create temporary table test_sales_state(label text primary key, batch_id uuid);

insert into public.customers(customer_id, customer_code)
values('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', '5000188291');

insert into test_sales_state(label, batch_id)
select 'sales_batch', (public.initiate_import_batch(
  'SALES','test-sales.xlsx',200,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  repeat('7',64),'{}'::jsonb,'SALES:test','test-sales-init',repeat('8',64)
)->>'batchId')::uuid;

select public.complete_import_upload((select batch_id from test_sales_state where label='sales_batch'), repeat('7',64), 200);

select is(
  (public.parse_sales_batch(
    (select batch_id from test_sales_state where label='sales_batch'),
    jsonb_build_array(
      jsonb_build_object('sheetName','Sheet1','sourceRowNumber','2','documentNo','INV-2026-001','customerCode','5000188291','billingDate','2026-08-01','amount','1500.50','quantity','10','rawPayload','{}'::jsonb,'rowSignature',repeat('9',64),'warnings','[]'::jsonb)
    ),
    'v1.0.0'
  )->>'readRowCount')::integer,
  1,
  'parse_sales_batch set-based execution parses 1 sales row correctly'
);

select is(
  (public.validate_sales_batch(
    (select batch_id from test_sales_state where label='sales_batch')
  )->>'validRowCount')::integer,
  1,
  'validate_sales_batch validates sales row matching customer 5000188291'
);

select is(
  (public.publish_sales_batch(
    (select batch_id from test_sales_state where label='sales_batch'),
    (select active_validation_run_id from public.import_batches where id = (select batch_id from test_sales_state where label='sales_batch')),
    'pub-key-1'
  )->>'publishedRowCount')::integer,
  1,
  'publish_sales_batch publishes sales invoice to public.invoices'
);

select is(
  (select count(*)::integer from public.invoices where document_no = 'INV-2026-001' and customer_id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  1,
  'public.invoices table contains the published invoice record'
);

select * from finish();
rollback;
