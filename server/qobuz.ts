import { ResolveError } from './errors.js';

type QobuzSource = { url: string; type: 'track' | 'album' };

/** Read identifiers through Qobuz's application-key API; never borrow player credentials. */
export async function qobuzIdentifier(source: QobuzSource, appId: string | undefined, request: typeof fetch): Promise<string> {
  if (!appId) throw new ResolveError(503, 'To match new Qobuz links, add QOBUZ_APP_ID to the server’s .env file and restart. Spotify and Apple Music links work with MUSICLINK_API_KEY.');
  const id = new URL(source.url).pathname.split('/').filter(Boolean).at(-1)!;
  const endpoint = new URL(`https://www.qobuz.com/api.json/0.2/${source.type}/get`);
  endpoint.searchParams.set('app_id', appId);
  endpoint.searchParams.set(`${source.type}_id`, id);
  let response: Response;
  try { response = await request(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }); }
  catch { throw new ResolveError(504, 'Qobuz couldn’t be reached. Please try again.'); }
  if (response.status === 401 || response.status === 403) throw new ResolveError(503, 'Qobuz rejected the application key. Check QOBUZ_APP_ID on the server.');
  if (response.status === 404) throw new ResolveError(404, 'This Qobuz song or album couldn’t be found. Check the link and try again.');
  if (!response.ok) throw new ResolveError(502, 'Qobuz metadata is temporarily unavailable. Please try again.');
  let data: { isrc?: unknown; upc?: unknown };
  try { data = await response.json() as typeof data; }
  catch { throw new ResolveError(502, 'Qobuz returned an unreadable metadata response.'); }
  const code = source.type === 'track' ? data?.isrc : data?.upc;
  const valid = typeof code === 'string' && (source.type === 'track' ? /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(code) : /^\d{12,14}$/.test(code));
  if (!valid) throw new ResolveError(404, 'Qobuz hasn’t provided a recording or album identifier for this item. Try its Spotify or Apple Music link instead.');
  return code as string;
}
