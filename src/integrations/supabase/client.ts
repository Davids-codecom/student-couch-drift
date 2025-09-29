import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://umikqccqrvcujbmwrlpc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWtxY2NxcnZjdWpibXdybHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2NDY1NjIsImV4cCI6MjA0MzIyMjU2Mn0.GJRhUJwCNNRcFjN58_qsJCo0kDzKYh2I3iLpnNZ9zBU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);