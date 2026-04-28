import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dduyxpkiqeetluwcuwwc.supabase.co';   // ← BEZ /rest/v1/
const supabaseAnonKey = 'sb_publishable_EALozLM9nmldgAtXH0QtTA_O_sVNp9f'; 
// ↑↑↑ OVDJE UBACI **CIJELI** svoj publishable key (bez ... na kraju)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});