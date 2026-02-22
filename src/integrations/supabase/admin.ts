import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mmrmjmgezsuanxccjkgv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcm1qbWdlenN1YW54Y2Nqa2d2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUyOTU5MSwiZXhwIjoyMDc1MTA1NTkxfQ.U1mBIeibI5lAsMxN7Qy0h4b0Sgmbh_x97CQ4Y_ipXJo';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
