import { createClient } from '@supabase/supabase-js';

// Bu URL'ler gerçek ortamda .env dosyasından (VITE_SUPABASE_URL) gelir.
// Mevcut backend yapılandırması (test/pilot modunda) localhost:54321 varsayar.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
