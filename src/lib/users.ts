import { supabase } from "@/lib/supabaseClient";

export interface PublicUserProfile {
  id: string;
  email: string | null;
  avatar_url: string | null;
  full_name: string | null;
  user_role: string | null;
  bio: string | null;
  university: string | null;
  program_name: string | null;
  program_year: number | null;
  program_type: string | null;
}

export const fetchAllUsers = async (): Promise<PublicUserProfile[]> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, avatar_url, full_name, user_role, bio, university, program_name, program_year, program_type")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchUserProfileById = async (id: string): Promise<PublicUserProfile | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, avatar_url, full_name, user_role, bio, university, program_name, program_year, program_type")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const fetchUserProfilesByIds = async (ids: string[]): Promise<PublicUserProfile[]> => {
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, avatar_url, full_name, user_role, bio, university, program_name, program_year, program_type")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return data ?? [];
};
