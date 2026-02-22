import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://mmrmjmgezsuanxccjkgv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcm1qbWdlenN1YW54Y2Nqa2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1Mjk1OTEsImV4cCI6MjA3NTEwNTU5MX0.EqnbVp3o2DV1DT7yGiGZNEnjUiHyDxuyJLxWh-2oXxQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
