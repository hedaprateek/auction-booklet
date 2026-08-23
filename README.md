# AuctionBook

Turn a spreadsheet of players into a print-ready auction booklet, then share it with every participant as a single file.

**→ [Open the app](https://hedaprateek.github.io/auction-booklet/)**

Built for club and corporate player auctions — cricket, football, kabaddi, volleyball, badminton, esports, anything. Nothing in the tool is tied to a particular sport: whichever columns your spreadsheet happens to have become the labels on the cards.

---

## What it does

Load an Excel or CSV file and AuctionBook gives you:

- **A printed booklet** — cover, rules page, teams page, an index of every player, and player cards laid out 1, 2, 4, 6, 8 or 9 to a page. Print it or save it as a PDF.
- **A shareable file** — one self-contained `.html` you can send on WhatsApp or email. It opens offline on any phone or laptop, with search, category filters, and every photo embedded.
- **A live auction tracker** (optional, inside the shared file) — mark players sold or unsold, assign them to teams, and watch each team's purse count down. Export the results as CSV when you're done.

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

Stats print in spreadsheet order, and a card fits **9** stats at 1–2 cards per page, **6** at 4–6, and **4** at 8–9. If you have more columns than that, set the ones you don't need to **Hide** so the right ones make the cut.

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

### Reopening a booklet later

**Save project** writes a `.auctionbook.json` holding your data, column mapping, settings and photos. **Open project** restores all of it. Handy when the player list changes the night before.

## Printing

Use **Print / PDF**, then in the browser's print dialog:

- Set **Margins** to *None*
- Turn on **Background graphics** — without it the section bands and stat tiles print blank

Page size follows your A4 / Letter setting. Each section starts on a fresh page, so the booklet can be split up and handed to different tables.

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
| `assets/js/main.js` | Wires up the UI |
| `assets/css/booklet.css` | The booklet's print design — also inlined into the export |

`render.js` returns strings rather than touching the DOM, so the preview, the print output and the shared file are all rendered by exactly the same code.

[SheetJS](https://sheetjs.com/) (Apache-2.0) is vendored in `assets/vendor/` to keep the app dependency-free and usable offline.

## Licence

MIT — see [LICENSE](LICENSE).
