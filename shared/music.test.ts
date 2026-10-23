import { describe, expect, it } from 'vitest';
import { Service, exampleUrl, formatLinks, musicEntityKey, parseMusicUrl } from './music';

describe('music URL validation', () => {
  it('identifies Apple songs across storefront, slug, and album-track URL forms', () => {
    const key = musicEntityKey('https://music.apple.com/song/1811903401');
    expect(musicEntityKey('https://music.apple.com/us/song/marlboro-rojo/1811903401')).toBe(key);
    expect(musicEntityKey('https://music.apple.com/gb/album/album-title/123?i=1811903401')).toBe(
      key,
    );
    expect(musicEntityKey('https://music.apple.com/us/song/different-song/1811903402')).not.toBe(
      key,
    );
    expect(musicEntityKey('https://music.apple.com/us/album/album-title/1811903401')).not.toBe(key);
    expect(musicEntityKey('https://open.qobuz.com/track/1811903401')).not.toBe(key);
  });

  it('removes tracking while retaining Apple Music’s song identity', () => {
    expect(parseMusicUrl(`${exampleUrl}?si=96f395cedf1445ef#fragment`).url).toBe(exampleUrl);
    const apple = parseMusicUrl('https://music.apple.com/us/album/a-title/123456?i=78910&ls=1');
    expect(apple).toEqual({
      service: Service.AppleMusic,
      type: 'track',
      url: 'https://music.apple.com/us/album/a-title/123456?i=78910',
    });
  });

  it.each([
    ['https://open.qobuz.com/track/1234', Service.Qobuz, 'track'],
    ['https://play.qobuz.com/album/abc123', Service.Qobuz, 'album'],
    ['https://www.qobuz.com/us-en/album/a-title/abc123', Service.Qobuz, 'album'],
    ['https://music.apple.com/us/song/a-title/123456', Service.AppleMusic, 'track'],
    ['https://music.apple.com/us/album/a-title/123456', Service.AppleMusic, 'album'],
    ['https://open.spotify.com/intl-de/album/03Mh5n7N3Qz7LTrs1sV5mS', Service.Spotify, 'album'],
  ])('recognizes %s', (url, service, type) => {
    expect(parseMusicUrl(url)).toMatchObject({ service, type });
  });

  it.each([
    'not a URL',
    'http://open.qobuz.com/track/123',
    'https://open.spotify.com.evil.test/track/123',
    'https://user:password@open.qobuz.com/track/123',
    'https://open.qobuz.com:8443/track/123',
    'https://open.spotify.com/playlist/03Mh5n7N3Qz7LTrs1sV5mS',
    'https://music.apple.com/us/album/a/123?i=bad',
    'https://localhost/track/123',
    'javascript:alert(1)',
  ])('rejects unsupported or unsafe input: %s', (url) =>
    expect(() => parseMusicUrl(url)).toThrow(),
  );

  it('copies available links in stable numbered service order', () => {
    expect(
      formatLinks({
        type: 'track',
        title: 'Song',
        artist: 'Artist',
        links: {
          [Service.AppleMusic]: 'https://music.apple.com/song/123',
          [Service.Spotify]: exampleUrl,
        },
      }),
    ).toBe(`1. Spotify: ${exampleUrl}\n2. Apple Music: https://music.apple.com/song/123`);
  });
});
