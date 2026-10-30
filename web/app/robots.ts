import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api.server';
import type { PublicSettings } from '@/lib/types';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const PRIVATE = ['/api/', '/account', '/checkout', '/cart', '/*/account', '/*/checkout', '/*/cart'];

/** AI assistants and their crawlers (ChatGPT, Claude, Perplexity, Gemini, Apple, Meta…), named so the admin switch is explicit. */
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'CCBot',
];

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await apiGet<PublicSettings>('/settings/public', { revalidate: 3600 }).catch(() => null);
  const allowAi = settings?.tracking?.allowAiCrawlers ?? true;
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      // Admin: Ayarlar → İzleme ve görünürlük → "AI ajanları siteyi okuyabilsin".
      { userAgent: AI_AGENTS, ...(allowAi ? { allow: ['/', '/llms.txt'], disallow: PRIVATE } : { disallow: '/' }) },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
