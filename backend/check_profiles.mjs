import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('customer_profile_versions').select('*').limit(5);
  console.log('Profiles:', JSON.stringify(data, null, 2));
}
run().catch(console.error);
