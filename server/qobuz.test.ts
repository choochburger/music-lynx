// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { qobuzIdentifier } from './qobuz';
import { createResolver } from './resolver';

describe('Qobuz input bridge', () => {
  it.each([
    ['track', 'https://open.qobuz.com/track/1234', { isrc: 'USABC2600001' }, 'USABC2600001'],
    ['album', 'https://www.qobuz.com/us-en/album/title/abc123', { upc: '0123456789012' }, '0123456789012'],
  ] as const)('reads a %s identifier from the authenticated metadata API', async (type, url, body, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    expect(await qobuzIdentifier({ url, type }, 'application-key', request)).toBe(code);
    const endpoint = request.mock.calls[0][0] as URL;
    expect(endpoint.origin).toBe('https://www.qobuz.com');
    expect(endpoint.pathname).toBe(`/api.json/0.2/${type}/get`);
    expect(endpoint.searchParams.get('app_id')).toBe('application-key');
    expect(endpoint.searchParams.get(`${type}_id`)).toBe(url.split('/').at(-1));
  });

  it('bridges a Qobuz track to the resolver using its ISRC', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ isrc: 'USABC2600001' }))
      .mockResolvedValueOnce(Response.json({ success: true, data: [{ type: 'track', title: 'Example', artist: 'Artist', platforms: { qobuz: 'https://open.qobuz.com/track/1234', apple_music: 'https://music.apple.com/song/123' } }] }));
    const resolver = createResolver('musiclink-key', request, 'qobuz-key');
    expect((await resolver('https://open.qobuz.com/track/1234')).title).toBe('Example');
    expect((request.mock.calls[1][0] as URL).searchParams.get('q')).toBe('USABC2600001');
    await resolver('https://music.apple.com/song/123');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('explains the required app key before making a request', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(qobuzIdentifier({ url: 'https://open.qobuz.com/track/1234', type: 'track' }, undefined, request)).rejects.toMatchObject({ status: 503, message: expect.stringContaining('QOBUZ_APP_ID') });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not guess when Qobuz has no recording identifier', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ title: 'Example' }));
    await expect(qobuzIdentifier({ url: 'https://open.qobuz.com/track/1234', type: 'track' }, 'app-key', request)).rejects.toMatchObject({ status: 404 });
  });
});
