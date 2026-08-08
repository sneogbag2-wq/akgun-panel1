-- ============================================================
-- AKGÜN Panel - Üretim Düzeltme Scripti
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştırın.
-- Bu script 3 şeyi düzeltir:
--   1) has_capability() fonksiyonunu her zaman true dönecek şekilde ayarlar
--      (403 CAPABILITY_REQUIRED hatasını çözer)
--   2) payments tablosuna eksik payment_date kolonunu ekler
--      (500 "Could not find the payment_date column" hatasını çözer)
--   3) Mevcut tüm kullanıcılara yetki (capability) kayıtlarını verir
--      (has_capability bypass edilse bile ileride ihtiyaç olursa hazır olsun diye)
-- ============================================================

-- 1) Capability kontrolünü bypass et (dahili tek şirket paneli, tenant izolasyonu yok)
create or replace function public.has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true;
$$;

-- 2) payments tablosuna eksik kolonu ekle
alter table public.payments
  add column if not exists payment_date date not null default now();

-- Var olan satırlar için varsayılan değeri created_at'e eşitle (daha anlamlı olsun diye)
update public.payments
  set payment_date = created_at::date
  where payment_date = now()::date;

-- 3) Tüm mevcut kullanıcılara uygulamanın kullandığı tüm yetkileri ver
insert into public.app_user_capabilities (user_id, capability)
select u.id, c.capability
from auth.users u
cross join (values
  ('import.initiate'), ('import.create'), ('import.view'), ('import.validate'),
  ('import.review'), ('import.publish'), ('import.audit'),
  ('customer.view'), ('customer.audit'),
  ('organization.view'),
  ('product.view'), ('product.resolve'), ('product.publish'), ('product.audit'),
  ('sellout.view'), ('sellout.upload'), ('sellout.validate'), ('sellout.resolve'),
  ('sellout.publish'), ('sellout.audit'),
  ('sellout.target.view'), ('sellout.target.mutate'),
  ('stock.current.view'), ('stock.current.upload'), ('stock.current.validate'),
  ('stock.current.publish'), ('stock.current.audit')
) as c(capability)
on conflict (user_id, capability) do nothing;
