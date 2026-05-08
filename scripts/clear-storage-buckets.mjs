/**
 * Deletes every object in EngiLog storage buckets (sketches, team-photos, log-images).
 * Uses the Service Role key — never commit that key or run this in the browser.
 *
 * Usage (PowerShell):
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret"
 *   node scripts/clear-storage-buckets.mjs
 *
 * Keys: Supabase Dashboard → Project Settings → API
 */

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["sketches", "team-photos", "log-images"];

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Recursively list file paths under `prefix` (empty string = bucket root). */
async function listFilePaths(bucket, prefix = "") {
  const paths = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket}/${prefix || "(root)"}: ${error.message}`);

  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const isFile = item.metadata != null;
    if (isFile) {
      paths.push(path);
    } else {
      const nested = await listFilePaths(bucket, path);
      paths.push(...nested);
    }
  }
  return paths;
}

async function removeInBatches(bucket, paths) {
  const batchSize = 100;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`${bucket} remove: ${error.message}`);
  }
}

async function main() {
  for (const bucket of BUCKETS) {
    const paths = await listFilePaths(bucket, "");
    console.log(`${bucket}: deleting ${paths.length} object(s)`);
    if (paths.length) await removeInBatches(bucket, paths);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
