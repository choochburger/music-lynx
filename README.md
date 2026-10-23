# Music Lynx

A React + TypeScript SPA for sharing songs and albums between different services (Spotify, Apple Music, Qobuz, etc).

## Local development

Requires Node.js 22.13+ in the 22.x line, or Node.js 24+ (recommended), and npm.

```sh
nvm use
npm install
cp .env.example .env
```

Get a MusicLink API key from [the MusicLink dashboard](https://musiclink.one/dashboard) and set `MUSICLINK_API_KEY` in `.env`. To resolve new Qobuz input links, also set `QOBUZ_APP_ID` to an application key issued by Qobuz. Spotify and Apple Music inputs can return Qobuz output links without this additional key. Then:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. One process serves the API and Vite with React hot reload. Restart after changing `.env`. Without a key the UI works, but lookup requests return a clear setup error. There are no fake or hardcoded matches in the app. “Try an example” makes a live lookup of [“I’ll Be There” by Me First and the Gimme Gimmes](https://open.spotify.com/track/03Mh5n7N3Qz7LTrs1sV5mS).

## How matching works

1. The browser validates a full public song or album URL and requests `/api/resolve?url=…`.
2. The Node server validates it again and calls [MusicLink’s documented v2 resolve endpoint](https://musiclink.one/docs). For Qobuz inputs, it first reads the ISRC (track) or UPC (album) from Qobuz’s application-key metadata API, then resolves that identifier. Only the server sees API keys.
3. The adapter returns artwork, title, artist, and validated matching links for the three supported services. The original service link is retained. Missing matches are labeled unavailable and excluded from copied lists.

Supported inputs: `open.spotify.com` track/album URLs (including localized URLs), `music.apple.com` song/album URLs (including `?i=` track links), `open.qobuz.com` and `play.qobuz.com` track/album URLs, and Qobuz’s regional public album/track URLs. Paste full links; shortened share URLs, playlists, and artists are outside this first version.

MusicLink requires an account/API key and has plan quotas. A first lookup can take 10–15 seconds; the MusicLink request times out after 30 seconds. Qobuz metadata has a separate 10-second timeout. Matches depend on provider coverage and regional catalogs; this app cannot guarantee every service or edition will match. The app displays the provider’s returned metadata without overriding it.

**Qobuz limitation:** although MusicLink lists Qobuz among its platforms, a live Qobuz URL request returned “Could not detect platform.” The Qobuz adapter avoids that unsupported input path. Fresh Qobuz lookups need `QOBUZ_APP_ID`; this adapter is covered by mocked tests but requires your issued key for live verification. Qobuz requires a valid application key under its [API terms](https://static.qobuz.com/apps/api/QobuzAPI-TermsofUse.pdf). Previously returned links resolve from the in-memory cache until it expires.

Successful results are cached by validated service URL in memory for one hour, capped at 150 entries. A basic per-IP limit permits 10 requests per minute. Nothing is persisted. Spotify and Apple Music URLs are sent to MusicLink to perform matching; Qobuz IDs are sent to Qobuz and their ISRC/UPC is sent to MusicLink. Artwork loads from the provider’s image URL; fonts load from Google Fonts with system fallbacks.

## Build and verification

```sh
npm test
npm run build
npm start
```

`build` typechecks both browser and server code, bundles the SPA into `dist/`, and compiles the server into `build/`. `start` serves both at **http://127.0.0.1:3000**. Set `PORT` and `HOST` as needed. The app needs a Node server in production; deploying `dist/` alone does not provide the lookup endpoint.

Tests cover input validation, tracking removal, Apple track identity, numbered copying, provider errors/timeouts, cache reuse, missing configuration, untrusted provider URLs, loading/results, partial matches, and clipboard failures. Provider responses in tests are synthetic fixtures, not verified catalog mappings.

Verified locally: 37 tests pass; production build and production HTTP smoke checks pass. Chrome checks cover desktop, 390 px and 320 px layouts, real clipboard copying, and live lookup results. The live Abbey Road album lookup returned Spotify and Apple Music, with Qobuz correctly shown as unavailable.

## Linting and formatting

ESLint uses `eslint.config.js` with recommended JavaScript/TypeScript checks, React Hooks checks, and Vite Fast Refresh rules. Unused variables are errors; intentionally unused parameters can start with `_`. Browser globals apply to `src/`, and Node globals apply to server and tool configuration files.

Prettier formats TypeScript, TSX, CSS, JSON, HTML, and Markdown. Defaults live in `.prettierrc.json`: two spaces, single quotes, semicolons, trailing commas, LF line endings, and a 100-column target. ESLint checks code correctness; CSS formatting is handled by Prettier rather than linted as JavaScript. Generated output, dependencies, lockfiles, and environment files are excluded from formatting.

```sh
npm run lint         # Check JavaScript, TypeScript, React, and CSS rules
npm run lint:fix     # Apply available ESLint and Stylelint fixes
npm run format      # Format source, styles, and configuration
npm run format:check
```

The checked-in VS Code workspace settings select **Prettier ESLint** (`rvest.vs-code-prettier-eslint`) for format-on-save, including TypeScript and CSS. The extension loads the locally installed `prettier-eslint` package, which supports the flat ESLint configuration; non-JavaScript languages use its Prettier formatting path. The optional Microsoft ESLint extension adds live diagnostics while editing. Install the recommended extensions when prompted, and reload VS Code if it was open during dependency installation.

Stylelint enforces a blank line between CSS rules and before at-rules such as `@media`, without adding a blank line before the first rule inside a block. Its configuration is in `stylelint.config.js`. Both `npm run format` and `npm run lint:fix` apply these spacing fixes. Install the recommended **Stylelint** extension (`stylelint.vscode-stylelint`) to apply the same fixes when explicitly saving CSS in VS Code; the workspace settings enable its save action alongside Prettier formatting.

## Extending the app

- `shared/music.ts`: service registry, URL parsing, response contract, copy formatting.
- `server/resolver.ts`: isolated provider adapter; swap the matching provider here.
- `server/qobuz.ts`: Qobuz application-key metadata adapter for track ISRCs and album UPCs.
- `server/index.ts`: API, basic rate limit, Vite development middleware, production hosting.
- `src/App.tsx`: input, loading, error, and result states.
- `src/ServiceIcon.tsx` and `src/styles.css`: service marks and presentation.

Add a service to the registry, URL validator, provider mapping, and icon component to include it in results and copying. Before public deployment, configure your hosting proxy/IP handling and appropriate distributed limits/quotas; current caches and limits apply to a single process.
