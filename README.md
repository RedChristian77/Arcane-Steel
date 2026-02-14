# Arcane Steel — Contractor's Handbook

> *"The following repository is mandated reading under Intercompany Freelancer Statute 14(c). Failure to review this material does not exempt you from liability. Nothing exempts you from liability."*

A thousand years ago, someone in a boardroom decided punching holes into other dimensions was cheaper than building spaceships. They were right. It was also catastrophically irresponsible — but quarterly earnings looked great, and that was really the point.

**Arcane Steel** is a tabletop RPG set in a world where corporations are governments, magic is toxic infrastructure, and you're a freelance dimensional laborer trying to survive the gig economy at the end of the world. This repository contains the web-based Contractor's Handbook and Character Builder.

### The World in Brief

- **Seven megacorporations** rule as sovereign nation-states — from a feudal fast-food monarchy to an entertainment theocracy with lawyer-assassins
- **Magic is everywhere** — it powers the lights, fuels the trains, and poisons anyone who channels it
- **Half the planet is dead zone** — land so saturated with dimensional toxicity that reality stops working properly
- **You are a contractor** — a freelancer with a sword, a toxicity reading, and a stack of waivers
- **The math never works** — earn 500 credits a week, spend 400 staying alive, save the rest toward augments that might keep you breathing long enough to do it again

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

> **Why do I need a server?** Opening `index.html` directly won't work because browsers block JavaScript from loading local JSON files (CORS security). The server is just Python serving files — no install, no dependencies. Like a contractor, it does the minimum required to keep things running.

## Deploy

### Netlify (Free)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Sign up (free — use Google/GitHub)
3. Drag the entire project folder onto the deploy area
4. Done — you get a URL like `random-name.netlify.app`
5. Customize in Site Settings > Domain Management

### GitHub Pages (Free)

1. Create a GitHub account at [github.com](https://github.com)
2. Create a new repository named `arcane-steel`
3. Upload all files from this folder
4. Go to Settings > Pages > Source: "Deploy from branch" > Branch: main
5. Your site: `yourusername.github.io/arcane-steel`

## Project Structure

```
arcane-steel/
├── index.html              <- The Handbook (start here)
├── builder.html            <- Character Builder
├── serve.sh / serve.bat    <- Local dev server
│
├── css/                    <- Styling
│   ├── variables.css       <- Colors, fonts, themes
│   ├── layout.css          <- Page structure
│   ├── sidebar.css         <- Navigation sidebar
│   ├── content.css         <- Text, callouts, flavor text
│   ├── tables.css          <- Data tables
│   ├── sections.css        <- Collapsible sections
│   ├── search.css          <- Search overlay
│   └── builder.css         <- Character builder styles
│
├── js/                     <- Application logic
│   ├── app.js              <- Main orchestrator
│   ├── components/         <- UI components
│   └── builder/            <- Character builder modules
│
└── data/
    ├── manifest.json       <- Page registry (edit to add/reorder pages)
    └── pages/              <- All handbook content (84 JSON files)
        ├── world-*.json            <- The World (12 pages)
        ├── creation-*.json         <- Character Creation (5 pages)
        ├── skills-*.json           <- Skills (3 pages)
        ├── combat-*.json           <- Combat (5 pages)
        ├── equipment-*.json        <- Equipment (5 pages)
        ├── trees-*.json            <- Augment Trees (12 pages)
        ├── abilities-*.json        <- Kit Abilities (9 pages)
        ├── rift-*.json             <- Rift Casting (4 pages)
        ├── scars-*.json            <- Scars & Toxicity (2 pages)
        ├── social-*.json           <- Social & Reputation (3 pages)
        ├── expeditions-*.json      <- Rift Expeditions (4 pages)
        ├── downtime-*.json         <- Downtime & Economy (3 pages)
        ├── enemies-*.json          <- Enemies & Threats (2 pages)
        └── gm-*.json              <- GM Tools (5 pages)
```

## Handbook Contents

| Section | Pages | What It Covers |
|---------|:-----:|----------------|
| The World | 12 | Setting, history, geography, species, culture, legends, NPCs |
| Corporations | 10 | The seven corps, brokers, factions, inter-corporate politics |
| Character Creation | 5 | Stats, resumes, kits, traits |
| Skills | 3 | Skill system, skill list, crafting |
| Combat | 5 | Actions, attacks, positioning, special actions, advanced rules |
| Equipment | 5 | Weapons, armor, consumables, economy, vehicles |
| Augment Trees | 12 | 11 specialization trees + overview |
| Kit Abilities | 9 | Combat abilities for each kit |
| Rift Casting | 4 | Magic system, patterns, advanced casting |
| Scars & Toxicity | 2 | Death, injury, mutations |
| Social & Reputation | 3 | Social mechanics, encounter templates |
| Rift Expeditions | 4 | Dimensions (cataloged, uncharted, and rumored) |
| Downtime & Economy | 3 | Activities, cost of living, base building |
| Enemies & Threats | 2 | Encounter building, enemy generator |
| GM Tools | 5 | Campaigns, contracts, sessions, quickstart, exploration tables |

## Editing Content

All handbook content lives in `data/pages/` as JSON files. Each file follows this structure:

```json
{
  "id": "page-id",
  "title": "Page Title",
  "subtitle": "Optional subtitle",
  "content": [
    { "type": "heading", "text": "Section Heading" },
    { "type": "paragraph", "text": "Body text with <strong>HTML</strong> formatting." },
    { "type": "flavor", "text": "A punchy one-liner for emotional impact." },
    { "type": "callout", "label": "Warning", "style": "rust", "text": "Important callout text." },
    { "type": "blockquote", "text": "<em>\"In-world quoted text.\"</em>" },
    { "type": "table", "headers": ["Col1", "Col2"], "rows": [["A", "B"]] },
    { "type": "divider" }
  ]
}
```

- **To edit a page:** Open its JSON in `data/pages/`, find the section, edit the text.
- **To add a page:** Create a new JSON file, add an entry to `data/manifest.json`.
- **To change styling:** Edit `css/variables.css` for colors and fonts.
- **To change rendering:** Edit `js/components/content.js` for how content types display.

## Version

v0.3 — Playtest Draft

> *"Orientation complete. Your contractor ID has been provisionally activated. Remember: your first scar is on us. After that, treatment is available at competitive market rates. Welcome to the grind."*
