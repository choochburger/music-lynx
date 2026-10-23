import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Check, Copy, ExternalLink, Link2, LoaderCircle, Music2, X } from 'lucide-react';
import { exampleUrl, formatLinks, parseMusicUrl, services, type MusicEntity } from '../shared/music';
import { ServiceIcon } from './ServiceIcon';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<MusicEntity | null>(null);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [artFailed, setArtFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const results = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { controller.current?.abort(); clearTimeout(copyTimer.current); }, []);
  useEffect(() => { if (entity) results.current?.focus(); }, [entity]);

  async function submit(event?: FormEvent, value = url) {
    event?.preventDefault();
    let cleanUrl: string;
    try { cleanUrl = parseMusicUrl(value).url; }
    catch (cause) { setError((cause as Error).message); input.current?.focus(); return; }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    clearTimeout(copyTimer.current);
    setUrl(value); setError(''); setCopyMessage(''); setCopied(''); setEntity(null); setArtFailed(false); setLoading(true);
    try {
      const response = await fetch(`/api/resolve?url=${encodeURIComponent(cleanUrl)}`, { signal: active.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We couldn’t match that link. Please try again.');
      if (!active.signal.aborted) setEntity(data as MusicEntity);
    } catch (cause) {
      if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : 'Couldn’t connect. Please try again.');
    } finally { if (!active.signal.aborted) setLoading(false); }
  }

  async function copy(text: string, id: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(id); setCopyMessage(id === 'all' ? 'All available links copied. Ready to share!' : 'Link copied.');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => { setCopied(''); setCopyMessage(''); }, 3000);
    } catch {
      setCopyMessage('Clipboard access isn’t available. Select and copy the links directly.');
    }
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Music Lynx home"><span className="brand-symbol"><Link2 size={25} strokeWidth={2.6} /></span>music<span className="brand-light">lynx</span><span className="brand-dot">.</span></a>
      <span className="header-note"><span className="status-dot" /> Different apps. Same music.</span>
    </header>

    <main>
      <section className="intro" aria-labelledby="page-title">
        <div className="eyebrow"><span /> MADE TO BE SHARED</div>
        <h1 id="page-title">Good music<br />travels<span className="title-dot">.</span><span className="title-doodle" aria-hidden="true"><svg viewBox="0 0 100 80"><path d="M8 60C20 16 48 10 65 26s-4 45-22 26S46 3 72 13M76 9l9 2-1 11" /></svg></span></h1>
        <p className="intro-description">Your favorite song. Their favorite app.<br />One link is all it takes to bring them together.</p>
      </section>

      <section className="workspace" aria-label="Music link finder">
        <form className="link-form" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor="music-url">Start with a song or album link</label>
          <div className={`input-group ${error ? 'has-error' : ''}`}>
            <Link2 className="input-icon" size={22} aria-hidden="true" />
            <input ref={input} id="music-url" type="url" value={url} onChange={(event) => { setUrl(event.target.value); if (error) setError(''); }} placeholder="Paste your music link here…" autoComplete="off" spellCheck={false} required aria-invalid={!!error} aria-describedby={error ? 'form-error' : 'supported-services'} disabled={loading} />
            {url && !loading && <button type="button" className="clear-button" aria-label="Clear link" onClick={() => { setUrl(''); setError(''); input.current?.focus(); }}><X size={17} /></button>}
            <button type="submit" className="go-button" disabled={loading}>{loading ? <><LoaderCircle size={19} className="spin" /> Finding</> : <>Go! <ArrowRight size={20} /></>}</button>
          </div>
          <div className="form-bottom"><div id="supported-services" className="supported"><span>Works with</span>{services.map((service) => <span className="supported-service" key={service.id}><ServiceIcon service={service.id} /><span>{service.name}</span></span>)}</div>
            <button type="button" className="example-button" disabled={loading} onClick={() => void submit(undefined, exampleUrl)}>Try an example <ArrowRight size={13} /></button></div>
          {error && <p id="form-error" className="error-message" role="alert">{error}</p>}
        </form>

        {loading && <div className="loading-panel" role="status"><div className="record-spinner"><Music2 size={27} /></div><h2>Following the music…</h2><p>Finding artwork and matching links across services.<br />A fresh lookup can take up to 30 seconds.</p></div>}

        {entity && !loading && <section className="results" ref={results} tabIndex={-1} aria-labelledby="result-title">
          <div className="entity-header">
            <div className="artwork">{entity.artwork && !artFailed ? <img src={entity.artwork} alt={`Cover artwork for ${entity.title}`} onError={() => setArtFailed(true)} referrerPolicy="no-referrer" /> : <Music2 size={38} aria-label="Artwork unavailable" />}</div>
            <div className="entity-description"><span className="entity-type">{entity.type === 'track' ? 'SONG' : 'ALBUM'} <span> / </span> READY TO TRAVEL</span><h2 id="result-title">{entity.title}</h2><p>{entity.artist}</p></div>
            <span className="found-badge"><Check size={13} /> {Object.keys(entity.links).length} links found</span>
          </div>
          <div className="links-heading"><span>LISTEN YOUR WAY</span><span>Same music, different doors.</span></div>
          <ol className="service-list">{services.map(({ id, name }) => {
            const link = entity.links[id];
            return <li className="service-row" key={id}><span className={`service-icon ${id}`}><ServiceIcon service={id} /></span><div className="service-details"><span className="service-name">{name}</span>{link ? <a className="service-url" href={link} target="_blank" rel="noopener noreferrer">{link}</a> : <span className="unavailable">No match available</span>}</div>{link && <><a className="open-link" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open in ${name}`}><ExternalLink size={17} /></a><button className={`copy-button ${copied === id ? 'is-copied' : ''}`} onClick={() => void copy(link, id)} aria-label={`Copy ${name} link`}>{copied === id ? <Check size={16} /> : <Copy size={16} />}<span>{copied === id ? 'Copied' : 'Copy'}</span></button></>}</li>;
          })}</ol>
          <div className="result-footer"><p>A little good music goes a long way.<br /><strong>Send some to a friend.</strong></p><button className="copy-all" onClick={() => void copy(formatLinks(entity), 'all')}>{copied === 'all' ? <Check size={18} /> : <Copy size={18} />}{copied === 'all' ? 'Copied!' : 'Copy all!'}</button></div>
          {Object.keys(entity.links).length < services.length && <p className="availability-note">Some matches aren’t available. Catalogs and availability vary by region.</p>}
        </section>}
      </section>
      <p className="copy-status" role="status" aria-live="polite">{copyMessage}</p>

      {!entity && !loading && <section className="how-it-works" aria-label="How it works"><div className="how-heading"><span>A SMALL LINK. A BIG CONNECTION.</span><ArrowDown size={16} /></div><div className="steps"><div><span className="step-number">01</span><h2>Find your favorite.</h2><p>Grab a song or album link<br />from your streaming app.</p></div><div><span className="step-number">02</span><h2>Connect the dots.</h2><p>We’ll find the same music<br />on the other services.</p></div><div><span className="step-number">03</span><h2>Pass it on.</h2><p>Copy the links. Drop them in chat.<br />Make someone’s day.</p></div></div></section>}
    </main>
    <footer className="site-footer"><span>Built for the love of music.</span><span className="footer-tag">NO PLAYBACK. JUST CONNECTIONS. <Link2 size={14} /></span></footer>
  </div>;
}
