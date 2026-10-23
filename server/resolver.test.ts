// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createResolver } from './resolver';
import { exampleUrl } from '../shared/music';

const item = {
  type: 'track', title: "It's Raining Men", artist: 'Me First and the Gimme Gimmes',
  image_url: 'https://example.com/art.jpg', platforms: {
    spotify: exampleUrl,
    qobuz: 'https://open.qobuz.com/track/123',
    apple_music: 'https://music.apple.com/us/album/a-title/123?i=456',
  },
};

describe('live resolver adapter', () => {
  it('maps provider data, keeps credentials server-side, and caches equivalent inputs', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [item] }));
    const resolver = createResolver('test-secret', request);
    const result = await resolver(exampleUrl);
    expect(result).toEqual({ type: 'track', title: item.title, artist: item.artist, artwork: item.image_url, links: item.platforms });
    expect(request.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-secret' });
    expect((request.mock.calls[0][0] as URL).searchParams.get('q')).toBe(exampleUrl);
    expect(JSON.stringify(result)).not.toContain('test-secret');
    await resolver(`${exampleUrl}?si=tracking`);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('preserves the submitted service but excludes unsafe and wrong-entity links', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [{ ...item, platforms: {
      qobuz: 'javascript:alert(1)', apple_music: 'https://music.apple.com/us/album/album/123',
    } }] }));
    expect((await createResolver('key', request)(exampleUrl)).links).toEqual({ spotify: exampleUrl });
  });

  it('selects the result containing the exact source when there are multiple releases', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [
      { ...item, title: 'Wrong release', platforms: { spotify: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' } }, item,
    ] }));
    expect((await createResolver('key', request)(exampleUrl)).title).toBe(item.title);
  });

  it.each([401, 403, 404, 429, 500])('handles provider status %i without inventing results', async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }));
    await expect(createResolver('key', request)(exampleUrl)).rejects.toMatchObject({ status: status === 500 ? 502 : status === 401 || status === 403 ? 503 : status });
  });

  it('reports missing configuration without contacting the provider', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(createResolver(undefined, request)(exampleUrl)).rejects.toMatchObject({ status: 503 });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects invalid input before contacting the provider', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(createResolver('key', request)('https://localhost/')).rejects.toMatchObject({ status: 400 });
    expect(request).not.toHaveBeenCalled();
  });

  it('handles timeouts and malformed successful responses', async () => {
    await expect(createResolver('key', vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')))(exampleUrl)).rejects.toMatchObject({ status: 504 });
    await expect(createResolver('key', vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')))(exampleUrl)).rejects.toMatchObject({ status: 502 });
    await expect(createResolver('key', vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [] })))(exampleUrl)).rejects.toMatchObject({ status: 404 });
  });
});
