/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose Vercel host to the browser bundle so Supabase emailRedirectTo uses the deployment URL, not localhost.
  ...(process.env.VERCEL_URL
    ? { env: { NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL } }
    : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
  },
};
export default nextConfig;