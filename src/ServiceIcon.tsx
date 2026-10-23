import { Music2 } from 'lucide-react';
import type { ServiceId } from '../shared/music';

export function ServiceIcon({ service }: { service: ServiceId }) {
  if (service === 'spotify') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" /><g fill="none" stroke="var(--spotify-line, white)" strokeWidth="1.65" strokeLinecap="round"><path d="M6 9c4-1.3 8-1 12 1M7 12.5c3.5-1 6.5-.7 10 1M8 16c2.5-.7 5-.4 7.7.7" /></g></svg>;
  if (service === 'apple_music') return <Music2 aria-hidden="true" strokeWidth={2} />;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8.2" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="11" cy="11" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m16.7 16.7 5.3 5.3" stroke="currentColor" strokeWidth="2.5" /></svg>;
}
