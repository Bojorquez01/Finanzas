import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ourxjvmwsxambjsvikyj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sseWiS82zEgoQKdwj54Diw_3xsrCMa7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);