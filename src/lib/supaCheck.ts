import { supabase } from "@/lib/supabaseClient";

export const checkSupabase = async (): Promise<string> => {
  try {
    const { error } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true });

    if (error) {
      return `Supabase error: ${error.message}`;
    }

    return "Supabase connected & RLS OK";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Supabase error: ${message}`;
  }
};
