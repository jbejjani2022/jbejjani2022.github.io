# josephbejjani.com

Personal site of Joseph Bejjani, built with [Astro](https://astro.build) and deployed to GitHub Pages.

Adding content never requires touching components. Everything below is a file edit.

## Local preview

Requires Node 22.12 or newer (CI uses Node 24).

```sh
npm ci
npm run dev                          # http://localhost:4321, live reload
npm run build && npm run preview     # production check
npm run check                        # type-check (astro check)
```

To test on your phone: `npm run preview -- --host` and open the LAN URL it prints.

## Where things live

| What | Where |
|---|---|
| Name, socials, nav | `src/config.ts` |
| Into the Fog homepage sketches | `src/assets/fog/hedgehogs/` |
| Landing text | `src/pages/index.astro` |
| About | `src/pages/about.astro` |
| Research list | `src/data/research.yaml` |
| Projects list | `src/data/projects.yaml` |
| Avalanches (`/intothefog/avalanches/`) | `src/data/avalanches.yaml` |
| Blog posts | `src/content/blog/<slug>/index.md` |
| Into the Fog pieces | `src/content/fog/<slug>.md` |
| Static files served as-is | `public/` (`camino/`, GIFs, `CNAME`) |

A typo in any frontmatter or YAML field (a missing `year`, an unknown key, a bad URL) fails the build with an error naming the file and field.

## New blog post

Create `src/content/blog/<slug>/index.md`. The folder name becomes the URL: `/blog/<slug>/`.

```markdown
---
title: "My New Post"      # wrap words in *asterisks* to italicize them, e.g. "Notes on *Walden*"
date: 2026-10-01
description: "One or two sentences, used for the meta description and RSS."
# authors: [Joseph Bejjani, Co Author]   # omit when you're the sole author
# toc: false                            # hide the table of contents
# draft: true                           # hidden from production builds (visible in `npm run dev`)
---

Intro paragraph.

## A section

![Alt text](./figure.png)

*This italic paragraph right after an image becomes its caption.*

A claim that needs a note.[^1] Inline math like $E = mc^2$, or display math:

$$
\mathcal{L}(\theta) = -\sum_t \log p_\theta(y_t \mid y_{<t})
$$

[^1]: Footnotes become sidenotes in the right margin automatically.
```

- **Images:** put them in the same folder and reference them as `./figure.png`. They are resized and served as WebP automatically.
- **Animated GIFs:** image optimization would convert them to WebP, so put them in `public/blog/<slug>/` instead and reference them as `/blog/<slug>/animation.gif`. See `mechagogue-jax` for an example.
- **Code:** use fenced code blocks with a language, e.g. ` ```python `.
- **Links:** external links open in a new tab automatically.
- **Table of contents:** built from `##`–`####` headings. It appears when a post has at least two.

## Cross-post (published elsewhere)

Create `src/content/blog/<slug>/index.md` with `externalUrl` and `externalSource` and no body. The blog index and RSS link straight to the external URL, and no local page is generated.

```markdown
---
title: "When Agents Prefer Hacking To Failure"
date: 2025-11-09
description: "Short summary."
authors: [Joseph Bejjani, Itamar Rocha Filho]
externalUrl: https://www.lesswrong.com/posts/…
externalSource: LessWrong
---
```

## Research item

Add an entry to `src/data/research.yaml`. Its position in the file is its position on the page.

```yaml
- title: "My Paper Title"
  year: 2026
  venue: NeurIPS 2026            # optional; peer-reviewed venues only
  authors: [Joseph Bejjani*, Co Author*, Advisor]   # "*" = equal contribution
  links:
    - { label: arxiv, url: "https://arxiv.org/abs/…" }
    - { label: code, url: "https://github.com/…" }
  image: my-paper.png            # optional; file in src/assets/research/
```

For a thumbnail, drop the image in `src/assets/research/` and set `image:` to its filename.

## Project

Add an entry to `src/data/projects.yaml`:

```yaml
- name: My Project
  url: https://myproject.com                 # optional; makes the name a link
  github: https://github.com/jbejjani2022/…  # optional; shows [github]
  youtube: https://www.youtube.com/@…        # optional; shows [youtube]
  description: One line. Inline [markdown links](https://…) work.
```

## Into the Fog pieces

Create `src/content/fog/<slug>.md`. The piece appears at `/intothefog/<slug>/`. The index is sorted newest first by `date`, which is never displayed. Filters above the list (all · poems · paintings · panels · prose · puzzlings) show one medium at a time, picked by `type` (sketches are "panels"; standalone pages like Avalanches are "puzzlings"). A filter appears once it has a piece; labels and order live in `MEDIUMS` in `src/pages/intothefog/index.astro`.

```markdown
---
title: "A Poem"
date: 2026-10-01
# type: prose              # poem (default), prose, sketch, or painting
# attribution: "Someone"   # for others' work; shown as "— Someone"
# draft: true
---

Write one line per line,
exactly as it should break.

Leave a blank line between stanzas.
&emsp;Use &emsp; to indent a line.
```

For **prose**, set `type: prose` and write each paragraph as a single line, with a blank line between paragraphs (every newline becomes a line break in Fog pieces).

For a **sketch** or **painting**, set `type: sketch` or `type: painting`, put the image in `src/assets/fog/`, and reference it as `![description](../../assets/fog/your-image.png)`. Any text after the image is its caption, written like prose. The type is added to the page as a class (`piece-sketch`, `piece-painting`), so each kind can be styled separately later.

### Removing the placeholders

The 11 public-domain placeholder pieces have `placeholder: true`. To remove them:

```sh
grep -l "placeholder: true" src/content/fog/* | xargs rm
```

Placeholders are already excluded from `/llms.txt`.

### Hedgehogs (and other Fog images)

The Into the Fog index shows a random hedgehog sketch on every load, picked from `src/assets/fog/hedgehogs/`. To add one, drop a `.png`/`.jpg` into that folder; to remove one, delete it. No code changes needed. Images are converted to WebP at build time and shown at their natural size (up to the column width), so export them at the size you want them displayed.

Keep any other Into the Fog images under `src/assets/fog/` so they get optimized too (not in `src/pages/`, which is only for routes, and not in `public/`, which skips optimization).

## Guestbook

`/guestbook/` lists entries; `/guestbook/sign/` explains how to sign (for humans and AI agents) and has the form. Submissions go to a Cloudflare Worker (`guestbook-worker/`), which holds them until you approve them. Approved entries live in `src/data/guestbook.yaml` and go live with a normal commit and push.

| What | Where |
|---|---|
| Questions, consent levels, field limits, daily cap | `src/lib/guestbook.ts` (shared by the site and the Worker) |
| Published entries | `src/data/guestbook.yaml` |
| Worker URL | `GUESTBOOK_API` in `src/config.ts` |
| Signing endpoint | `guestbook-worker/src/worker.ts` |

### Moderating

Set `GUESTBOOK_ADMIN_TOKEN` in your shell (the token you gave the Worker; see below), then:

```sh
npm run guestbook                 # review waiting entries: approve, approve with a reply, decline, skip
npm run guestbook -- list         # just print what's waiting
npm run guestbook -- reply <id>   # add or replace your reply on a published entry
```

Approving writes only the entry's public fields to `src/data/guestbook.yaml`. Private notes, contact emails, and prompts not approved for publishing stay on the Worker. Then check `git diff`, commit, and push. You can also edit replies in the YAML by hand. Restart `npm run dev` to see newly approved entries locally.

To pause signing (e.g. during a flood), set `PAUSED` to `"true"` in `guestbook-worker/wrangler.jsonc` and run `npm --prefix guestbook-worker run deploy`.

### Adding a question

Append to `QUESTIONS` in `src/lib/guestbook.ts` with a new `id`. Never change or reuse an existing id (entries refer to it); the wording can change freely. Add `from` to credit someone else's question. Redeploy the Worker afterwards so it accepts the new id.

### Testing

```sh
npm test                                           # YAML writer + Worker tests (node --test)
npm --prefix guestbook-worker run dev              # local Worker on http://127.0.0.1:8787
PUBLIC_GUESTBOOK_API=http://127.0.0.1:8787 npm run dev   # site, signing to the local Worker
```

For the local Worker, put `ADMIN_TOKEN=...` in `guestbook-worker/.dev.vars` (gitignored), and use `GUESTBOOK_API=http://127.0.0.1:8787` with the CLI.

### The Worker

One-time setup, from `guestbook-worker/`:

1. `npm install`, then `npx wrangler login`.
2. `npx wrangler kv namespace create GUESTBOOK`, and put the `id` it prints into `kv_namespaces` in `wrangler.jsonc`.
3. `npx wrangler deploy`. It serves the Worker at `guestbook.josephbejjani.com` (the `routes` entry in `wrangler.jsonc`; Cloudflare creates the DNS record), which is what `GUESTBOOK_API` in `src/config.ts` points to.
4. `npx wrangler secret put ADMIN_TOKEN`, and enter a long random token (e.g. from `openssl rand -hex 32`). Use the same value for `GUESTBOOK_ADMIN_TOKEN`. Redeploy with `npm run deploy` after changing `worker.ts`, `validate.ts`, or `src/lib/guestbook.ts`.

## Deployment

Pushing to `master` deploys the site. The `Deploy` workflow (`.github/workflows/deploy.yml`) builds it with Astro and publishes it to GitHub Pages at https://josephbejjani.com. Watch runs under the repo's **Actions** tab (about 1–2 minutes). GitHub Pages is set to **Source: GitHub Actions** in the repo's Settings → Pages.

The custom domain comes from the repo's Pages settings; `public/CNAME` keeps it recorded in the repo too.

### The old Jekyll site

is archived in the `jekyll-archive` branch of this repo.
