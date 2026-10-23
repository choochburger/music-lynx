import { parseMusicUrl, services, type MusicEntity } from '../shared/music.js';
import { qobuzIdentifier } from './qobuz.js';
import { ResolveError } from './errors.js';
export { ResolveError } from './errors.js';

type ProviderItem = {
  type?: unknown; title?: unknown; artist?: unknown; image_url?: unknown;
  platforms?: Record<string, unknown>;
};

function publicImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; }
  catch { return; }
}

export function createResolver(apiKey: string | undefined, request: typeof fetch = fetch, qobuzAppId?: string) {
  // Bounded, process-local cache. No pasted links are written to disk.
  const cache = new Map<string, { entity: MusicEntity; expires: number }>();
  return async (input: string): Promise<MusicEntity> => {
    let source: ReturnType<typeof parseMusicUrl>;
    try { source = parseMusicUrl(input); }
    catch (error) { throw new ResolveError(400, (error as Error).message); }
    const cached = cache.get(source.url);
    if (cached && cached.expires > Date.now()) return cached.entity;
    if (!apiKey) throw new ResolveError(503, 'Live matching isn’t configured yet. Add MUSICLINK_API_KEY to the server’s .env file, then restart the app.');

    const endpoint = new URL('https://api.musiclink.one/v2/resolve');
    endpoint.searchParams.set('q', source.service === 'qobuz' ? await qobuzIdentifier(source, qobuzAppId, request) : source.url);
    let response: Response;
    try {
      response = await request(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ResolveError(504, 'Matching took too long or the music service couldn’t be reached. Please try again.');
    }
    if (response.status === 429) throw new ResolveError(429, 'The matching service is busy or its lookup allowance has been reached. Please try again later.');
    if (response.status === 401 || response.status === 403) throw new ResolveError(503, 'The matching service rejected the server’s API key. Check MUSICLINK_API_KEY and restart the app.');
    if (response.status === 404) throw new ResolveError(404, 'No match found. Check that the song or album is publicly available and try its full link.');
    if (!response.ok) throw new ResolveError(502, 'The matching service is temporarily unavailable. Please try again.');

    let body: { success?: boolean; data?: ProviderItem[] };
    try { body = await response.json() as typeof body; }
    catch { throw new ResolveError(502, 'The matching service returned an unreadable response. Please try again.'); }
    const candidates = Array.isArray(body?.data) ? body.data.filter((entry) => entry?.type === source.type) : [];
    const item = candidates.find((entry) => {
      const link = entry.platforms?.[source.service];
      try { return typeof link === 'string' && parseMusicUrl(link).url === source.url; }
      catch { return false; }
    }) ?? candidates.find((entry) => !entry.platforms?.[source.service]);
    if (body?.success !== true || !item || typeof item.title !== 'string' || !item.title.trim()) {
      throw new ResolveError(404, 'No matching song or album was found. Try another link.');
    }
    const links: MusicEntity['links'] = {};
    for (const { id } of services) {
      const candidate = item.platforms?.[id];
      if (typeof candidate !== 'string') continue;
      try {
        const parsed = parseMusicUrl(candidate);
        if (parsed.service === id && parsed.type === source.type) links[id] = parsed.url;
      } catch { /* Never render unrecognized URLs from an upstream response. */ }
    }
    // The submitted public link is always available, even if the provider omits it.
    links[source.service] = source.url;
    const entity: MusicEntity = {
      type: source.type, title: item.title,
      artist: typeof item.artist === 'string' ? item.artist : 'Unknown artist',
      artwork: publicImage(item.image_url), links,
    };
    // A validated returned link can also resolve back to this result during the cache lifetime.
    for (const url of Object.values(links)) {
      if (cache.size >= 150) cache.delete(cache.keys().next().value!);
      cache.set(url, { entity, expires: Date.now() + 60 * 60 * 1000 });
    }
    return entity;
  };
}
