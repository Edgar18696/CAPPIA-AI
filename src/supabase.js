import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://arqzpqkkpwikyecdbopf.supabase.co";

const supabaseKey =
  "sb_publishable_mZKsf_QQVl3i309rw5MrlA_8JcT9chX";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);