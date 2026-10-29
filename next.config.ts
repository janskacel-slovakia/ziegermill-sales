import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
};

export default nextConfig;

// Cloudflare (Workers via OpenNext): lets `next dev` see the Worker's bindings.
initOpenNextCloudflareForDev();
