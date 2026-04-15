# senior-sale (source)

React + Vite source for the Senior Sale page on josephbejjani.com.

- **Live URL**: https://josephbejjani.com/senior-sale
- **Source**: this directory (`senior-sale-src/`) — excluded from Jekyll via `_config.yml`
- **Build output**: `../senior-sale/` (served by Jekyll at `/senior-sale/`)

## Develop

```sh
npm run dev
```

Local dev server runs at the path `/senior-sale/` (not root), since `base` is set in `vite.config.js`.

## Deploy

```sh
npm run build
```

This builds to `../senior-sale/` at the repo root. Commit both `senior-sale-src/` (source) and `senior-sale/` (built output) so GitHub Pages can serve the built assets.

## Editing

Primary file: `src/App.jsx`. Configuration constants (CSV URL, contact info) are at the top of that file.
