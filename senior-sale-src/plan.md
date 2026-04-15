# Senior Sale — Implementation Plan

## Stage 1: Project Setup
**Goal**: Initialize React project with Vite, install dependencies
**Status**: Complete

## Stage 2: Core Data Layer
**Goal**: CSV fetching, parsing with Papaparse, auto-refresh logic
**Status**: Complete

## Stage 3: UI Components
**Goal**: Header, filter bar, item grid, cards, sold badges, footer
**Status**: Complete

## Stage 4: Image Lightbox
**Goal**: Modal with large image view, close on escape/click-outside
**Status**: Complete

## Stage 5: Styling & Responsiveness
**Goal**: Final polish — responsive grid, hover effects, mobile layout
**Status**: Complete

---

## Implementation Summary

All features implemented in a single `App.jsx` file:

- **CSV fetch + parse** via Papaparse, with 60s auto-refresh and manual Refresh button
- **Dynamic category filter chips** derived from data
- **Sort by price** (cycle: off → low→high → high→low)
- **Hide sold toggle**
- **Auto-convert Google Drive share URLs** to embeddable direct image URLs (no manual reformatting needed in the sheet)
- **Card grid** with image, name, category tag, price, details (with auto-linked URLs), and SOLD badge
- **Lightbox** for full-size image viewing (Escape / click-outside to close)
- **Responsive** grid via `auto-fill, minmax(280px, 1fr)`
- **Fonts**: Playfair Display (header) + DM Sans (body) via Google Fonts
- **Placeholders** at top of file: `SHEET_CSV_URL`, `CONTACT_NAME`, `CONTACT_PHONE`, `CONTACT_EMAIL`

## Stage 6: Integrate into josephbejjani.com Jekyll site
**Goal**: Serve the React app at https://josephbejjani.com/senior-sale
**Status**: Complete

- Renamed directory to `senior-sale-src/` (React source lives here)
- Added `senior-sale-src` to Jekyll exclude list in `_config.yml`
- Configured Vite with `base: "/senior-sale/"` and `outDir: "../senior-sale"`
- `npm run build` now produces the deployable static site at repo-root `/senior-sale/`, which Jekyll passes through unchanged
- Verified with `bundle exec jekyll build` → `_site/senior-sale/` contains correct assets

## Deploy workflow

```sh
cd senior-sale-src
npm run build      # produces ../senior-sale/
cd ..
git add senior-sale-src senior-sale _config.yml
git commit -m "update senior sale"
git push           # GitHub Pages rebuilds Jekyll → live at /senior-sale
```
