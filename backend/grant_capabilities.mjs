import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Fetching users...');
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) throw authErr;
  
  const caps = [
    'import.initiate', 'import.create', 'import.view', 'import.validate', 'import.review', 'import.publish', 'import.audit',
    'customer.view', 'customer.audit',
    'organization.view',
    'product.view', 'product.resolve', 'product.publish', 'product.audit',
    'sellout.view', 'sellout.upload', 'sellout.validate', 'sellout.resolve', 'sellout.publish', 'sellout.audit',
    'sellout.target.view', 'sellout.target.mutate',
    'stock.current.view', 'stock.current.upload', 'stock.current.validate', 'stock.current.publish', 'stock.current.audit',
  ];
  
  for (const user of users.users) {
     console.log(`Granting capabilities to ${user.email} (${user.id})...`);
     for (const cap of caps) {
        const { error: insErr } = await supabase.from('app_user_capabilities').upsert({ user_id: user.id, capability: cap }, { onConflict: 'user_id,capability' });
        if (insErr) {
           console.log(`Error granting ${cap}:`, insErr.message);
        }
     }
  }
  console.log('Done!');
}
run().catch(console.error);
