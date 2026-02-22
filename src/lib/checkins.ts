import { supabase } from "@/lib/supabaseClient";

const BUCKET = "couch-photos";
const BASE_PATH = "checkins";

const buildPath = (bookingId: string, fileName: string) => `${BASE_PATH}/${bookingId}/${fileName}`;

export const uploadCheckInPhoto = async (bookingId: string, file: File): Promise<string> => {
  const extension = (() => {
    const parts = file.name.split(".");
    const ext = parts.length > 1 ? parts.pop() : null;
    if (!ext) return "jpg";
    return ext.toLowerCase();
  })();

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = buildPath(bookingId, fileName);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Unable to resolve uploaded photo URL.");
  }

  await supabase
    .from("booking_requests")
    .update({ has_checkin_photo: true })
    .eq("id", bookingId);

  return data.publicUrl;
};

export const listCheckInPhotos = async (bookingId: string): Promise<string[]> => {
  const folder = `${BASE_PATH}/${bookingId}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, {
      limit: 50,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    if ((error as { status?: number }).status === 404) {
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .filter((file) => file.name)
    .map((file) => supabase.storage.from(BUCKET).getPublicUrl(buildPath(bookingId, file.name)).data.publicUrl)
    .filter((url): url is string => Boolean(url));
};
