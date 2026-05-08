import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const PROJECT_ASSET_BUCKETS = ["sketches", "team-photos", "log-images"] as const;

/** List every object path under `prefix` (e.g. project UUID folder). */
async function listFilePathsRecursive(
  supabase: SupabaseClient<Database>,
  bucket: (typeof PROJECT_ASSET_BUCKETS)[number],
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`${bucket}/${prefix || "(root)"}: ${error.message}`);
    if (!data?.length) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata != null) {
        paths.push(path);
      } else {
        paths.push(...(await listFilePathsRecursive(supabase, bucket, path)));
      }
    }
    if (data.length < pageSize) break;
  }
  return paths;
}

async function removePaths(
  supabase: SupabaseClient<Database>,
  bucket: (typeof PROJECT_ASSET_BUCKETS)[number],
  paths: string[],
) {
  const batchSize = 100;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`${bucket} remove: ${error.message}`);
  }
}

/**
 * Deletes all Storage objects for one notebook under `sketches/`, `team-photos/`, and `log-images/`
 * (paths are `{projectId}/…` per uploadProjectFile).
 */
export async function deleteProjectStorage(supabase: SupabaseClient<Database>, projectId: string) {
  for (const bucket of PROJECT_ASSET_BUCKETS) {
    const paths = await listFilePathsRecursive(supabase, bucket, projectId);
    if (paths.length) await removePaths(supabase, bucket, paths);
  }
}
