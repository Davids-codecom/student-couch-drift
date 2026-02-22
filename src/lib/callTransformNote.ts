import { supabase } from "@/lib/supabaseClient";

export const callTransformNote = async (content: string) => {
  const { data, error } = await supabase.functions.invoke("transform-note", {
    body: { content },
  });

  if (error) {
    throw error;
  }

  return data as { message: string; note?: unknown };
};
