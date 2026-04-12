import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Bucket = "team-photos" | "log-images" | "sketches";

export async function uploadProjectFile(
  supabase: SupabaseClient<Database>,
  bucket: Bucket,
  projectId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
