# Arcane Steel — Contractor's Handbook

A web-based handbook and character builder for the Arcane Steel tabletop RPG.

## Local Development

You need Python 3 installed (comes pre-installed on Mac/Linux).

**Mac/Linux:**
```bash
chmod +x serve.sh
./serve.sh
```

**Windows:**
```
Double-click serve.bat
```

Then open **http://localhost:8080** in your browser.

> **Why do I need a server?** Opening `index.html` directly won't work because
> browsers block JavaScript from loading local JSON files (CORS security).
> The server is just Python serving files — no install, no dependencies.

## Deploy to Netlify (Free)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Sign up (free — use Google/GitHub)
3. Drag the entire `arcane-steel` folder onto the deploy area
4. Done — you get a URL like `random-name.netlify.app`
5. Customize in Site Settings → Domain Management

## Deploy to GitHub Pages (Free)

1. Create a GitHub account at [github.com](https://github.com)
2. Create a new repository named `arcane-steel`
3. Upload all files from this folder
4. Go to Settings → Pages → Source: "Deploy from branch" → Branch: main
5. Your site: `yourusername.github.io/arcane-steel`

## Project Structure

```
arcane-steel/
├── index.html              ← Handbook entry point
├── builder.html            ← Character builder
├── serve.sh / serve.bat    ← Local development server
│
├── css/
│   ├── variables.css       ← Colors, fonts, themes
│   ├── reset.css           ← Base normalization
│   ├── layout.css          ← Page structure
│   ├── sidebar.css         ← Navigation sidebar
│   ├── content.css         ← Text elements (paragraphs, quotes, etc.)
│   ├── tables.css          ← Data tables
│   ├── sections.css        ← Collapsible sections
│   ├── search.css          ← Search overlay
│   ├── chapter-nav.css     ← Home page, chapter headers, prev/next
│   ├── progress.css        ← Reading progress bar
│   └── builder.css         ← Character builder styles
│
├── js/
│   ├── app.js              ← Main orchestrator
│   ├── components/
│   │   ├── sidebar.js      ← Nav rendering
│   │   ├── search.js       ← Full-text search
│   │   ├── chapter.js      ← Chapter page rendering
│   │   ├── content.js      ← JSON → HTML conversion
│   │   ├── sections.js     ← Collapse/expand
│   │   ├── home.js         ← Landing page
│   │   ├── theme.js        ← Dark/light toggle
│   │   └── progress.js     ← Reading progress
│   └── builder/
│       ├── builder-app.js  ← Builder logic & state
│       ├── builder-ui.js   ← Step render functions
│       ├── builder-export.js ← JSON/text export
│       └── builder-data.js ← Game data (species, kits, etc.)
│
└── data/
    ├── manifest.json       ← Chapter list (edit to add/remove chapters)
    ├── ch01-the-world.json
    ├── ch02-character-creation.json
    ├── ... (one file per chapter)
    └── ch14-gm-tools.json
```

## Editing Content

- **To edit a chapter:** Open its JSON in `data/`, find the section, edit the text.
- **To add a chapter:** Create a new JSON file, add an entry to `manifest.json`.
- **To change colors/fonts:** Edit `css/variables.css`.
- **To change how content renders:** Edit `js/components/content.js`.

## Version

v0.3 — Playtest Draft
