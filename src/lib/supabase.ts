import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://bkcxawdyjfxlnexkuwde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrY3hhd2R5amZ4bG5leGt1d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzQ4OTcsImV4cCI6MjA4NjUxMDg5N30.D5ervl7NLghCbEnELbQlIGTB_7tdLR_P0AyT0SDNdZI';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
