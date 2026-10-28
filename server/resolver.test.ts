// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createResolver } from './resolver';
import { Service, exampleUrl } from '../shared/music';

const item = {
  type: 'track',
  title: "I'll Be There",
  artist: 'Me First and the Gimme Gimmes',
  image_url: 'https://example.com/art.jpg',
  platforms: {
    [Service.Spotify]: exampleUrl,
    [Service.Qobuz]: 'https://open.qobuz.com/track/123',
    [Service.AppleMusic]: 'https://music.apple.com/us/album/a-title/123?i=456',
  },
};

describe('live resolver adapter', () => {
  it('explains monthly quota exhaustion without suggesting an immediate retry', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { success: false, error: 'Monthly request limit exceeded.', plan: 'free' },
          { status: 429 },
        ),
      );
    await expect(createResolver('key', request)(exampleUrl)).rejects.toMatchObject({
      status: 429,
      message:
        'MusicLink’s monthly lookup allowance has been reached. New lookups will be available when it resets on the 1st of next month.',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ 'Retry-After': '1' }, { retryAfter: 1 }, '1 second'],
    [{ 'Retry-After': '60' }, { retryAfter: 60 }, '60 seconds'],
    [{}, { retryAfter: 60 }, '60 seconds'],
  ])(
    'explains temporary rate limits using the provider’s retry delay',
    async (headers, body, delay) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { success: false, error: 'Rate limit exceeded.', ...body },
            { status: 429, headers },
          ),
        );
      await expect(createResolver('key', request)(exampleUrl)).rejects.toMatchObject({
        status: 429,
        message: `MusicLink is receiving too many requests. Please try again in ${delay}.`,
      });
    },
  );

  it('handles an unreadable rate-limit body without turning it into a server error', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not JSON', { status: 429 }));
    await expect(createResolver('key', request)(exampleUrl)).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining('MusicLink’s request limit has been reached.'),
    });
  });

  it('matches a shared Apple Music URL to the same song in the provider’s canonical URL', async () => {
    const input = 'https://music.apple.com/us/song/marlboro-rojo/1811903401';
    const canonical = 'https://music.apple.com/song/1811903401';
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            ...item,
            title: 'Different song',
            platforms: { [Service.AppleMusic]: 'https://music.apple.com/song/1811903402' },
          },
          {
            ...item,
            title: 'Marlboro Rojo',
            artist: 'Fuerza Regida',
            platforms: { ...item.platforms, [Service.AppleMusic]: canonical },
          },
        ],
      }),
    );
    const resolver = createResolver('test-key', request);
    const result = await resolver(input);
    expect(result.title).toBe('Marlboro Rojo');
    expect(result.links[Service.AppleMusic]).toBe(input);
    expect(result.links[Service.Spotify]).toBe(exampleUrl);
    await resolver(canonical);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects a genuinely different Apple recording rather than matching by title', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            ...item,
            title: 'Marlboro Rojo',
            platforms: { [Service.AppleMusic]: 'https://music.apple.com/song/1811903402' },
          },
        ],
      }),
    );
    await expect(
      createResolver(
        'test-key',
        request,
      )('https://music.apple.com/us/song/marlboro-rojo/1811903401'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('maps provider data, keeps credentials server-side, and caches equivalent inputs', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ success: true, data: [item] }));
    const resolver = createResolver('test-secret', request);
    const result = await resolver(exampleUrl);
    expect(result).toEqual({
      type: 'track',
      title: item.title,
      artist: item.artist,
      artwork: item.image_url,
      links: item.platforms,
    });
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer test-secret',
    });
    expect((request.mock.calls[0][0] as URL).searchParams.get('q')).toBe(exampleUrl);
    expect(JSON.stringify(result)).not.toContain('test-secret');
    await resolver(`${exampleUrl}?si=tracking`);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('preserves the submitted service but excludes unsafe and wrong-entity links', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            ...item,
            platforms: {
              [Service.Qobuz]: 'javascript:alert(1)',
              [Service.AppleMusic]: 'https://music.apple.com/us/album/album/123',
            },
          },
        ],
      }),
    );
    expect((await createResolver('key', request)(exampleUrl)).links).toEqual({
      [Service.Spotify]: exampleUrl,
    });
  });

  it('selects the result containing the exact source when there are multiple releases', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            ...item,
            title: 'Wrong release',
            platforms: {
              [Service.Spotify]: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
            },
          },
          item,
        ],
      }),
    );
    expect((await createResolver('key', request)(exampleUrl)).title).toBe(item.title);
  });

  it.each([401, 403, 404, 429, 500])(
    'handles provider status %i without inventing results',
    async (status) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }));
      await expect(createResolver('key', request)(exampleUrl)).rejects.toMatchObject({
        status: status === 500 ? 502 : status === 401 || status === 403 ? 503 : status,
      });
    },
  );

  it('reports missing configuration without contacting the provider', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(createResolver(undefined, request)(exampleUrl)).rejects.toMatchObject({
      status: 503,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects invalid input before contacting the provider', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(createResolver('key', request)('https://localhost/')).rejects.toMatchObject({
      status: 400,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('handles timeouts and malformed successful responses', async () => {
    await expect(
      createResolver(
        'key',
        vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')),
      )(exampleUrl),
    ).rejects.toMatchObject({ status: 504 });
    await expect(
      createResolver(
        'key',
        vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')),
      )(exampleUrl),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      createResolver(
        'key',
        vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data: [] })),
      )(exampleUrl),
    ).rejects.toMatchObject({ status: 404 });
  });
});
