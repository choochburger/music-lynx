export const services = [
  { id: 'spotify', name: 'Spotify' },
  { id: 'qobuz', name: 'Qobuz' },
  { id: 'apple_music', name: 'Apple Music' },
] as const;

export type ServiceId = (typeof services)[number]['id'];
export type MusicEntity = {
  type: 'track' | 'album';
  title: string;
  artist: string;
  artwork?: string;
  links: Partial<Record<ServiceId, string>>;
};

export const exampleUrl = 'https://open.spotify.com/track/2DAvoJU1ZjcWVd8jL0OR8s';

export function parseMusicUrl(input: string): {
  url: string;
  service: ServiceId;
  type: MusicEntity['type'];
} {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Paste a complete Spotify, Qobuz, or Apple Music song or album URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    input.length > 2048
  ) {
    throw new Error('Use a public HTTPS music link from Spotify, Qobuz, or Apple Music.');
  }
  let service: ServiceId;
  let type: MusicEntity['type'];
  const path = url.pathname;
  if (
    url.hostname === 'open.spotify.com' &&
    /^\/(?:intl-[a-z-]+\/)?(track|album)\/[A-Za-z0-9]{22}\/?$/.test(path)
  ) {
    service = 'spotify';
    type = path.includes('/track/') ? 'track' : 'album';
    url.pathname = path.replace(/^\/intl-[a-z-]+\//, '/');
  } else if (
    url.hostname === 'music.apple.com' &&
    /^\/(?:[a-z]{2}\/)?(?:album|song)\/(?:[^/]+\/)?\d+\/?$/.test(path)
  ) {
    service = 'apple_music';
    const track = url.searchParams.get('i');
    if (track !== null && !/^\d+$/.test(track))
      throw new Error('This Apple Music song link has an invalid track ID.');
    type = track || path.includes('/song/') ? 'track' : 'album';
  } else if (
    (['open.qobuz.com', 'play.qobuz.com'].includes(url.hostname) &&
      /^\/(track|album)\/[A-Za-z0-9]+\/?$/.test(path)) ||
    (['www.qobuz.com', 'qobuz.com'].includes(url.hostname) &&
      /^\/[a-z]{2}-[a-z]{2}\/(track|album)\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path))
  ) {
    service = 'qobuz';
    type = path.includes('/track/') ? 'track' : 'album';
  } else {
    throw new Error(
      'That link isn’t supported yet. Use a full song or album URL from Spotify, Qobuz, or Apple Music.',
    );
  }
  const appleTrack = service === 'apple_music' ? url.searchParams.get('i') : null;
  url.search = '';
  url.hash = '';
  if (appleTrack) url.searchParams.set('i', appleTrack);
  return { url: url.toString(), service, type };
}

export function formatLinks(entity: MusicEntity): string {
  return services
    .filter(({ id }) => entity.links[id])
    .map(({ id, name }, index) => `${index + 1}. ${name}: ${entity.links[id]}`)
    .join('\n');
}
