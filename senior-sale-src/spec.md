# Senior Sale Website — Spec & Design Doc

## Overview

A single-page website where graduating seniors list dorm items for sale. Underclassmen browse, find something they want, and text/email the designated contact person to buy it. Items are managed via a shared Google Sheet — no backend, no database, no CMS.

**Working title:** "Prescott 20A-26 Senior Sale"

**Lifespan:** ~1 month (graduation window)

---

## Architecture

```
Google Sheet (data source)
    ↓ published as CSV
Static site (React single-page app)
    ↓ fetches & parses CSV on load
Browser renders item grid + filters
```

No server. No database. The site is a static front-end that pulls from a published Google Sheet CSV URL.

---

## Google Sheet Structure

The sheet has one row per item. Columns:

| Column | Type | Notes |
|---|---|---|
| `name` | text | Item name, e.g. "IKEA Kallax Shelf" |
| `category` | text | Free text, but use a dropdown in the sheet for consistency. e.g. "Furniture", "Clothing", "Electronics", "Kitchen", "Books", "Other" |
| `price` | number | In dollars. `0` = free. |
| `image` | URL | Public URL to an image. Use Google Drive (with "Anyone with link" sharing) or Imgur. |
| `details` | text | Description and/or a URL to the original product page. URLs in this field should be auto-detected and rendered as clickable links. |
| `sold` | boolean | `TRUE` or `FALSE`. When an item sells, the sheet owner updates this to `TRUE`. |

### Google Sheet Setup Instructions

1. Create a Google Sheet with the columns above as headers in row 1.
2. For the `category` column, set up Data Validation → Dropdown with your categories. This is for your own convenience to avoid typos — the site reads categories dynamically from the data.
3. For the `sold` column, set up Data Validation → Dropdown with `TRUE` / `FALSE`.
4. For images: upload photos to Google Drive → right-click → "Get link" → set to "Anyone with the link" → copy the link. Convert the share URL to a direct image URL:
   - Share URL format: `https://drive.google.com/file/d/{FILE_ID}/view`
   - Direct URL format: `https://drive.google.com/uc?export=view&id={FILE_ID}`
   - Paste the direct URL into the `image` column.
5. Publish the sheet: File → Share → Publish to web → select the sheet tab → choose "Comma-separated values (.csv)" → Publish. Copy the resulting URL — this is what the site fetches.

### Sync Behavior

- The site fetches the published CSV on page load.
- A visible "Refresh" button lets users manually re-fetch to pick up changes.
- The site also silently re-fetches every 60 seconds in the background.
- Note: Google's published CSV has a caching delay of a few minutes. This is fine for this use case.

---

## Page Layout & Design

### Design Direction

**Tone:** Minimal, clean, but with personality. This is a college dorm sale, not a luxury marketplace. Think: a well-designed flyer on a dorm bulletin board. Slightly irreverent, not corporate.

**Aesthetic guidance:**
- Light background, high contrast
- One strong accent color for interactive elements (buttons, tags, sold badges)
- A fun, slightly playful display font for the header — nothing too serious
- Clean sans-serif for body text
- Card-based grid layout for items
- Subtle hover effects on cards
- No heavy gradients, no dark mode, no over-design
- Should feel like it was made by someone with taste who spent 20 minutes on it, not 20 hours

### Page Structure (top to bottom)

#### 1. Header
- Title: "Prescott 20A-26 Senior Sale"
- Subtitle / tagline: something short and fun, like "We're graduating. Take our stuff." (Claude Code can pick something good)
- Contact info block: name, phone number, and email of the designated contact person. Clearly labeled: "Want something? Text or email [Name]."
  - Phone and email should be tappable (`tel:` and `mailto:` links)
  - **Contact info should be hardcoded in the site source** (not in the sheet). It's static and there's only one contact.

#### 2. Filter / Sort Bar
A horizontal bar with:
- **Category filter chips/buttons:** Dynamically generated from all unique `category` values found in the data. Plus an "All" option. Clicking one filters the grid. Active filter is visually highlighted. These should appear as pill-shaped buttons or chips.
- **Sort by price:** Toggle or dropdown — "Price: Low → High" / "Price: High → Low"
- **Hide sold items:** A toggle/checkbox. Default: OFF (sold items are shown but visually marked). When ON, sold items are hidden entirely.

#### 3. Item Grid
A responsive grid of item cards. Adapts from ~3-4 columns on desktop to 1-2 on mobile.

**Each card contains:**
- **Image:** Fills the top portion of the card. Clickable — opens the image lightbox/popup.
- **Name:** Bold, below the image.
- **Category:** Small tag/pill label.
- **Price:** Prominent. Formatted as "$X" or "Free" if $0.
- **Details:** Text below the price. URLs within the text are auto-detected and rendered as clickable links (open in new tab). Keep the text at a reasonable max height — if it's very long, truncate with a "show more" toggle or just let it flow (preference: let it flow, keep cards natural height).
- **Sold badge:** If `sold === TRUE`, overlay a "SOLD" badge on the card. The card should also be visually dimmed/muted (e.g. reduced opacity, desaturated image) so it's clear at a glance.

#### 4. Image Lightbox / Popup
When a user clicks an item's image:
- A modal/overlay appears with the image displayed large.
- The image should be zoomable (pinch-to-zoom on mobile, scroll-to-zoom or click-to-zoom on desktop) or at minimum displayed at full resolution so the user can inspect it.
- Click outside or press X / Escape to close.
- Simple dark backdrop overlay.

#### 5. Footer
- Small, minimal.
- Maybe a line like "Made with ☕ and senioritis"
- No functional content needed.

---

## Technical Implementation Notes

### Stack
- **React** (single .jsx file, rendered as an artifact)
- All styles inline or in a `<style>` block within the file — no separate CSS file
- No external state management — just `useState` / `useEffect`
- CSV parsing: use Papaparse library (available in the artifact environment)

### CSV Fetching
```javascript
const SHEET_CSV_URL = "YOUR_PUBLISHED_CSV_URL_HERE";

// Fetch on mount
// Re-fetch every 60 seconds
// Manual refresh button triggers immediate re-fetch
```

The published CSV URL should be a constant at the top of the file that the user replaces with their own.

### URL Detection in Details Field
Use a regex to detect URLs in the `details` text and wrap them in `<a>` tags:
```
/(https?:\/\/[^\s]+)/g
```
Links should open in a new tab (`target="_blank" rel="noopener noreferrer"`).

### Category Derivation
```javascript
const categories = [...new Set(items.map(item => item.category))].filter(Boolean).sort();
```
No hardcoded category list. Categories appear/disappear as items are added/removed from the sheet.

### Price Formatting
- `0` → "Free"
- Any other number → `$X` (no cents unless the value has them)

### Sold State
- `sold` column value `TRUE` (case-insensitive) → item is sold
- Anything else → item is available

### Responsive Behavior
- Desktop (>1024px): 3-4 column grid
- Tablet (768-1024px): 2-3 column grid
- Mobile (<768px): 1-2 column grid
- Filter bar should wrap gracefully on mobile
- Cards should have consistent spacing

---

## Data Flow Summary

```
1. Seniors add items to Google Sheet (name, category, price, image URL, details, sold)
2. Sheet is published as CSV
3. Site fetches CSV → parses with Papaparse → renders cards
4. Buyer sees item they want → texts/emails the contact person
5. Contact person coordinates the sale
6. Seller marks item as sold (TRUE) in the sheet
7. Site picks up the change on next refresh cycle
```

---

## Out of Scope

- User accounts / authentication
- Shopping cart / checkout / payments
- Comments or messaging
- Multiple images per item
- Search (the item count is small enough that filters + scrolling is fine)
- Dark mode
- Backend / server

---

## Placeholder Values to Replace

When building the site, use these placeholders that the user will replace:

- `SHEET_CSV_URL` — the published Google Sheet CSV URL
- `CONTACT_NAME` — the contact person's name
- `CONTACT_PHONE` — the contact person's phone number
- `CONTACT_EMAIL` — the contact person's email address