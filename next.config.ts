import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Only the real domain may be indexed (see app/robots.ts); every other host gets noindex on the pages.
const INDEXED_HOSTS = "(www\\.)?ziegermill\\.sk";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        missing: [{ type: "host", value: INDEXED_HOSTS }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

// Cloudflare (Workers via OpenNext): lets `next dev` see the Worker's bindings.
initOpenNextCloudflareForDev();
