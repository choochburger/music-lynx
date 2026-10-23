import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { Service, exampleUrl } from '../shared/music';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const entity = {
  type: 'track',
  title: "I'll Be There",
  artist: 'Me First and the Gimme Gimmes',
  artwork: 'https://example.com/cover.jpg',
  links: {
    [Service.Spotify]: exampleUrl,
    [Service.Qobuz]: 'https://open.qobuz.com/track/123',
    [Service.AppleMusic]: 'https://music.apple.com/song/456',
  },
};

describe('the share flow', () => {
  it('validates a pasted URL before making a request', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<App />);
    fireEvent.change(screen.getByLabelText('Start with a song or album link'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go!' }));
    expect(screen.getByRole('alert').textContent).toContain('complete');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows loading, renders real results, and copies one or all available links', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Try an example/ }));
    expect(screen.getByText('Following the music…')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      `/api/resolve?url=${encodeURIComponent(exampleUrl)}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    resolve(Response.json(entity));
    expect(await screen.findByRole('heading', { name: entity.title })).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('src')).toBe(entity.artwork);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Qobuz link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(entity.links[Service.Qobuz]));
    fireEvent.click(screen.getByRole('button', { name: 'Copy all!' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `1. Spotify: ${exampleUrl}\n2. Qobuz: ${entity.links[Service.Qobuz]}\n3. Apple Music: ${entity.links[Service.AppleMusic]}`,
      ),
    );
    expect(await screen.findByText('All available links copied. Ready to share!')).toBeTruthy();
  });

  it('makes partial results and clipboard failures visible', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ...entity, links: { [Service.Spotify]: exampleUrl } })),
    );
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
      configurable: true,
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Try an example/ }));
    await screen.findByRole('heading', { name: entity.title });
    expect(screen.getAllByText('No match available')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Copy Qobuz link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy all!' }));
    expect(await screen.findByText(/Clipboard access isn’t available/)).toBeTruthy();
  });

  it('shows upstream errors and allows another attempt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'No match found.' }, { status: 404 })),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Try an example/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('No match found.');
    expect((screen.getByRole('button', { name: 'Go!' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
