-- Tüm mevcut kullanıcılara uygulamanın gerektirdiği tüm yetkileri (capability) verir.
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştırın.
-- Yeni bir kullanıcı eklediğinizde bu scripti tekrar çalıştırmanız yeterli.

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
