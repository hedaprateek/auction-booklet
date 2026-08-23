# AuctionBook

Turn a spreadsheet of players into a print-ready auction booklet, then share it with every participant as a single file.

**→ [Open the app](https://hedaprateek.github.io/auction-booklet/)**

Built for club and corporate player auctions — cricket, football, kabaddi, volleyball, badminton, esports, anything. Nothing in the tool is tied to a particular sport: whichever columns your spreadsheet happens to have become the labels on the cards.

---

## What it does

Load an Excel or CSV file and AuctionBook gives you:

- **A printed booklet** — cover, rules page, teams page, an index of every player, and player cards laid out 1, 2, 4, 6, 8 or 9 to a page. Print it or save it as a PDF.
- **A shareable file** — one self-contained `.html` you can send on WhatsApp or email. It opens offline on any phone or laptop, with search, category filters, and every photo embedded.
- **A live auction tracker** (optional, inside the shared file) — mark players sold or unsold, assign them to teams, and watch each team's purse count down. Then print the **final squads** sheet or export the results as CSV.
- **A QR code on the cover**, so anyone holding a paper copy can pull up the digital one.

Everything runs in the browser. Your player list is never uploaded anywhere — there is no server to upload it to.

## Using it

1. **Drop in your spreadsheet.** First row is the header row; one player per row after that.
2. **Check the columns.** AuctionBook guesses what each one means. Change anything it got wrong, and rename any label you want printed differently.
3. **Add photos** (optional). Select a folder of images — each is matched to a player by file name.
4. **Set up the booklet.** Title, logo, accent colour, how many cards per page, which column splits the booklet into sections.
5. **Print it, or download the shareable file.**

No spreadsheet handy? Click **Try it with demo data**, or grab [`sample/sample-cricket.xlsx`](sample/sample-cricket.xlsx).

## How your columns are read

Every column is assigned a role. You can change any of them.

| Role | What it does |
| --- | --- |
| **Name** | The player name. Required — everything else is optional. |
| **Lot / ID** | The number called out at the auction. Or let AuctionBook number players itself. |
| **Photo** | An image URL, or a file name matching one of your uploaded photos. |
| **Category** | Splits the booklet into sections — Batter / Bowler, Forward / Defender, Set A / Set B. |
| **Base price** | Highlighted on the card and listed in the index. |
| **Team** | Current or previous team. |
| **Subtitle** | Small line under the name — age, city, playing style. |
| **Badge** | A pill on the card — Marquee, Captain, Under-19. |
| **Stat** | The numbers grid. Anything unrecognised lands here. |
| **Note** | Longer free text at the bottom of the card. |
| **Hide** | Left out of the booklet entirely. |

Stats print in spreadsheet order, and a card fits **9** stats at 1–2 cards per page, **6** at 4–6, and **4** at 8–9. If you have more columns than that, set the ones you don't need to **Hide** so the right ones make the cut. At 8 and 9 cards per page there's no room for notes, so those are dropped too.

**Personal columns are hidden by default.** Anything that looks like a phone number, email, address, date of birth or ID number is set to *Hide* automatically — a booklet gets handed around a room, and that data has no business being in it. You can override this, but think twice.

### Photos

Name each image file after the player (`ravi-kumar.jpg`) or their lot number (`12.jpg`). Capitals, spaces, underscores and hyphens are all ignored when matching. Images are resized in the browser before they're embedded, so a booklet of 200 players stays a few MB rather than a few hundred.

If your sheet has a column of image URLs instead, map it to **Photo** and it will be used directly.

### Money

Base prices are formatted Indian-style by default — `₹5 L`, `₹2.5 Cr`. Switch to `1,00,000`, `100,000`, or **As typed** if you'd rather keep whatever's in the cell. The currency symbol is a free text field, so `$`, `£`, `AED` all work.

## Sharing the booklet

**Download shareable booklet** gives you one `.html` file. Send it however you like — it has no dependencies and works with no internet connection.

To put it on the web instead, drop it into a repository with GitHub Pages turned on:

```bash
mkdir -p docs/booklets
cp ~/Downloads/my-league.html docs/booklets/
git add docs/booklets && git commit -m "Add auction booklet" && git push
```

It'll be live at `https://<your-username>.github.io/<repo>/booklets/my-league.html`.

Note that anyone with the link can read it, so treat it like a public document.

## The live auction board

The shared booklet's tracker is per-device: each person's marks stay on their own phone. That's right for a booklet, wrong for the auction itself, where everyone should be looking at the same numbers.

**Download live auction board** produces a second HTML file for auction day: one board where the organiser records each result — sold, unsold, which team, what price — and every other viewer watches the purses count down. Team chips instead of dropdowns, big touch targets, and a search that filters *your* view without touching anyone else's.

Opened as a plain file it works fine, just for you alone; the badge in the corner says **Local only · not shared**. To make it genuinely shared, publish it as a Claude Artifact with the `artifact` capability — ask Claude to "publish this as an artifact with the artifact capability". Then:

- The **owner and editors** record results; their clicks are saved as them.
- **Everyone else** gets a read-only view that still updates live. The badge tells each viewer which one they are.

There's no server and no database. On a Claude live-doc artifact the page's markup *is* the shared document, so a click that changes the DOM is the edit. That constraint shapes the file: every row is served as HTML rather than rendered by script, state lives in `data-*` attributes on the row, team choice is buttons rather than a `<select>` (select values aren't captured), and anything computed — purse totals, search, filters — sits inside `<artifact-local>` so it stays yours.

A demo built from the sample data: <https://claude.ai/code/artifact/14779b37-687c-470c-8a2a-c140dd4dcbae>

### Reopening a booklet later

**Save project** writes a `.auctionbook.json` holding your data, column mapping, settings and photos. **Open project** restores all of it. Handy when the player list changes the night before.

## Printing

Use **Print / PDF**, then in the browser's print dialog:

- Set **Margins** to *None*
- Turn on **Background graphics** — without it the section bands and stat tiles print blank

Page size follows your A4 / Letter setting.

### Sections: separate pages or continuous

By default each category starts on a fresh page, so the booklet can be split up and handed to different tables. If your categories are small that wastes paper — a 3-player section still costs a whole sheet. Turn off **Start each section on a new page** and sections run on from one another, with the heading bands staying exactly where they belong. On the demo data that's 11 pages instead of 12; the lopsider your categories, the more it saves.

Cards stay the same size either way, and a section heading never lands orphaned at the foot of a page.

### Teams, logos and final squads

Add teams as `Name, Purse` (one per line) and you get a teams page with blank squad slots to write into. Drop in a folder of logo images — matched by file name, same as player photos — and they appear next to each team.

If you enabled the tracker in the shared file, **Final squads** turns the day's results into a printable sheet: each team's signings with prices, purse remaining, and the unsold list.

## Running it locally

It's a static site with no build step. Any web server will do:

```bash
git clone https://github.com/hedaprateek/auction-booklet.git
cd auction-booklet
python -m http.server 8000    # or: npx serve
```

Then open <http://localhost:8000>. It needs a server rather than `file://` because it loads ES modules.

```bash
node scripts/selftest.mjs      # smoke-tests the render pipeline
node scripts/make-sample.mjs   # regenerates the sample spreadsheet
```

### Layout of the code

| File | Role |
| --- | --- |
| `assets/js/parse.js` | Spreadsheet → headers + rows |
| `assets/js/mapping.js` | Guesses what each column means |
| `assets/js/render.js` | Rows + settings → booklet HTML |
| `assets/js/export.js` | Builds the self-contained shareable file |
| `assets/js/liveboard.js` | Builds the live auction board |
| `assets/js/main.js` | Wires up the UI |
| `assets/css/booklet.css` | The booklet's print design — also inlined into the export |

`render.js` returns strings rather than touching the DOM, so the preview, the print output and the shared file are all rendered by exactly the same code.

Two libraries are vendored in `assets/vendor/` to keep the app dependency-free and usable offline: [SheetJS](https://sheetjs.com/) (Apache-2.0) for reading spreadsheets, and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) for the cover QR, which is emitted as inline SVG so it stays sharp in print.

## Licence

MIT — see [LICENSE](LICENSE).
