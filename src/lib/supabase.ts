import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // We will generate this

const supabaseUrl = 'https://bkcxawdyjfxlnexkuwde.supabase.co';
const supabaseAnonKey = 'sb_publishable_TfLFDiC85GJmePlaRdgAjA_7O47RTzS';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
