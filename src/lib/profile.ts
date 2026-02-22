import { supabase } from "@/lib/supabaseClient";

export type UserRole = "host" | "renter";
export type ProgramType = "bsc" | "msc" | "phd" | "other";

export interface UserProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  user_role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  student_id_url: string | null;
  university: string | null;
  program_name: string | null;
  program_year: number | null;
  program_type: ProgramType | null;
  payout_account_holder: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_bank_country: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type UserProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  user_role: UserRole | null;
  avatar_url: string | null;
  bio: string | null;
  student_id_url: string | null;
  university: string | null;
  program_name: string | null;
  program_year: number | null;
  program_type: ProgramType | null;
  payout_account_holder: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_bank_country: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const mapRowToProfile = (row: UserProfileRow): UserProfileRecord => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  user_role: row.user_role ?? "renter",
  avatar_url: row.avatar_url,
  bio: row.bio,
  student_id_url: row.student_id_url,
  university: row.university,
  program_name: row.program_name,
  program_year: row.program_year,
  program_type: row.program_type,
  payout_account_holder: row.payout_account_holder,
  payout_account_number: row.payout_account_number,
  payout_bank_name: row.payout_bank_name,
  payout_bank_country: row.payout_bank_country,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const fetchUserProfile = async (id: string): Promise<UserProfileRecord | null> => {
  const { data, error } = await supabase
    .from<UserProfileRow>("user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToProfile(data) : null;
};

export const fetchUserProfileByEmail = async (email: string): Promise<UserProfileRecord | null> => {
  const { data, error } = await supabase
    .from<UserProfileRow>("user_profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToProfile(data) : null;
};

export const upsertUserProfile = async (
  profile: Partial<UserProfileRecord> & { id: string; email: string },
): Promise<UserProfileRecord> => {
  const payload = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name ?? null,
    user_role: profile.user_role ?? "renter",
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    student_id_url: profile.student_id_url ?? null,
    university: profile.university ?? null,
    program_name: profile.program_name ?? null,
    program_year: profile.program_year ?? null,
    program_type: profile.program_type ?? null,
    payout_account_holder: profile.payout_account_holder ?? null,
    payout_account_number: profile.payout_account_number ?? null,
    payout_bank_name: profile.payout_bank_name ?? null,
    payout_bank_country: profile.payout_bank_country ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from<UserProfileRow>("user_profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToProfile(data);
};
