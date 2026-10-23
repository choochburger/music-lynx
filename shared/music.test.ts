import { describe, expect, it } from 'vitest';
import { exampleUrl, formatLinks, parseMusicUrl } from './music';

describe('music URL validation', () => {
  it('removes tracking while retaining Apple Music’s song identity', () => {
    expect(parseMusicUrl(`${exampleUrl}?si=tracking#fragment`).url).toBe(exampleUrl);
    const apple = parseMusicUrl('https://music.apple.com/us/album/a-title/123456?i=78910&ls=1');
    expect(apple).toEqual({ service: 'apple_music', type: 'track', url: 'https://music.apple.com/us/album/a-title/123456?i=78910' });
  });

  it.each([
    ['https://open.qobuz.com/track/1234', 'qobuz', 'track'],
    ['https://play.qobuz.com/album/abc123', 'qobuz', 'album'],
    ['https://www.qobuz.com/us-en/album/a-title/abc123', 'qobuz', 'album'],
    ['https://music.apple.com/us/song/a-title/123456', 'apple_music', 'track'],
    ['https://music.apple.com/us/album/a-title/123456', 'apple_music', 'album'],
    ['https://open.spotify.com/intl-de/album/2DAvoJU1ZjcWVd8jL0OR8s', 'spotify', 'album'],
  ])('recognizes %s', (url, service, type) => {
    expect(parseMusicUrl(url)).toMatchObject({ service, type });
  });

  it.each([
    'not a URL', 'http://open.qobuz.com/track/123', 'https://open.spotify.com.evil.test/track/123',
    'https://user:password@open.qobuz.com/track/123', 'https://open.qobuz.com:8443/track/123',
    'https://open.spotify.com/playlist/2DAvoJU1ZjcWVd8jL0OR8s', 'https://music.apple.com/us/album/a/123?i=bad',
    'https://localhost/track/123', 'javascript:alert(1)',
  ])('rejects unsupported or unsafe input: %s', (url) => expect(() => parseMusicUrl(url)).toThrow());

  it('copies available links in stable numbered service order', () => {
    expect(formatLinks({ type: 'track', title: 'Song', artist: 'Artist', links: {
      apple_music: 'https://music.apple.com/song/123', spotify: exampleUrl,
    } })).toBe(`1. Spotify: ${exampleUrl}\n2. Apple Music: https://music.apple.com/song/123`);
  });
});
