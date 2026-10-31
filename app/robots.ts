import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Only the real domain may be indexed. test.ziegermill.sk, *.workers.dev and *.vercel.app stay out of search engines.
// Keep in step with INDEXED_HOSTS in next.config.ts.
const INDEXED_HOSTS = ['ziegermill.sk', 'www.ziegermill.sk'];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase();
  return INDEXED_HOSTS.includes(host)
    ? { rules: { userAgent: '*', allow: '/' } }
    : { rules: { userAgent: '*', disallow: '/' } };
}
