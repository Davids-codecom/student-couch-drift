import { supabase } from "@/lib/supabaseClient";

const STORAGE_BUCKET = "profile-photos";
const STUDENT_ID_FOLDER = "student-ids";
const SELFIE_FOLDER = "selfies";

const generateFileName = (file: File) => {
  const ext = file.name.split(".").pop();
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${random}${ext ? `.${ext}` : ""}`;
};

export const uploadStudentId = async (userId: string, file: File): Promise<string> => {
  const fileName = generateFileName(file);
  const filePath = `${userId}/${STUDENT_ID_FOLDER}/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    throw new Error(error.message ?? "Failed to upload student ID.");
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to fetch uploaded student ID URL.");
  }

  return data.publicUrl;
};

export const uploadSelfie = async (userId: string, file: File): Promise<string> => {
  const fileName = generateFileName(file);
  const filePath = `${userId}/${SELFIE_FOLDER}/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    throw new Error(error.message ?? "Failed to upload selfie.");
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to fetch uploaded selfie URL.");
  }

  return data.publicUrl;
};
