import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hitopawvdtzviclihisf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdG9wYXd2ZHR6dmljbGloaXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzAyOTYsImV4cCI6MjEwMTcwNjI5Nn0.mc56a_4q87hSQYdPH6RpQD28cS2rez7i5OdIMgxcfzI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

