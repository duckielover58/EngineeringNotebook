import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ProjectStorageBucket = "team-photos" | "log-images" | "sketches";

/** Path inside a bucket from a Supabase public object URL, or null if not recognized. */
export function publicUrlToStoragePath(publicUrl: string, bucket: ProjectStorageBucket): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

export async function uploadProjectFile(
  supabase: SupabaseClient<Database>,
  bucket: ProjectStorageBucket,
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
