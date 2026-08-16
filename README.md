# firezerdemese.github.io

Source for my portfolio site, live at <https://firezerdemese.github.io>.

It is a static site with no build step and no dependencies: plain HTML, CSS and
JavaScript, served straight from this repository by GitHub Pages off the `main`
branch. The only external requests are to Google Fonts.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page. Markup only. |
| `style.css` | All styling. Colours and fonts are CSS variables at the top. |
| `script.js` | Hero canvas, typewriter, scroll reveal, skills filter, video modal, image zoom. |
| `favicon.svg` | Tab icon. |
| `Resume.pdf` | Linked from the hero and the contact section. |
| `images/` | Architecture diagrams for the project cards, hand-written SVG. |
| `assets/` | Demo videos. |
| `sqlguardian-demo/` | Prebuilt React bundle of the SQLGuardian dashboard. Runs on data baked into the bundle, so there is no backend to keep alive. |
| `flowlens-demo/` | Static walkthrough of a FlowLens audit run, plus the incident report page it produces. |

## Running it locally

The page itself opens fine from disk, but the demo sub-sites and the video modal
need real HTTP. Serve the folder from its root:

```
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Editing

**Colours and fonts** are the CSS variables in the `:root` block at the top of
`style.css`. Changing `--gold` re-themes the accent everywhere.

**Adding a project**: copy one `.project-card` block in the projects section of
`index.html`. The meta bar takes a date and a status pill (`live` or `dev`); the
body is a `.project-info` column and an optional `.project-visual` holding a
diagram. Drop the `.project-visual` and add `single` to `.project-body` for a
full-width card.

**Adding a demo video**: put the MP4 in `assets/`, then add a button to that
card's links:

```html
<button type="button" class="link-btn video"
        data-video="./assets/your-video.mp4"
        data-video-title="Project · Demo">Demo Video</button>
```

`script.js` wires up every `[data-video]` on the page, so no other change is
needed.

**Adding a skill card**: copy a `.skill-card` and set `data-domain` to `db`, `ai`
or `eng` so the filter buttons pick it up.

## Projects featured here

- [SQLGuardian](https://github.com/Firezerdemese/sqlguardian) — AI-assisted SQL Server health monitoring
- [QueryLens](https://github.com/Firezerdemese/querylens) — SQL workbench with a read-only boundary
- [FlowLens](https://github.com/Firezerdemese/flowlens) — write-audit-publish gate for SQL Server ETL
