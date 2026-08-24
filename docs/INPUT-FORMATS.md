# Input formats

AuctionBook reads `.xlsx`, `.xls`, `.xlsm` and `.csv`. There is one rule:

> **The first row is headers. Every row after it is one player.**

Everything else is negotiable. There is no required column except a name, and even that is guessed if you don't have one.

Ready-to-open examples live in [`sample/formats/`](../sample/formats/) — GitHub renders them as tables, so you can look before you download.

| File | Shows |
| --- | --- |
| [`minimal.csv`](../sample/formats/minimal.csv) | The floor: name, category, base price. Nothing else. |
| [`cricket.csv`](../sample/formats/cricket.csv) | A full sheet — lot numbers, styles, career stats, badges, remarks. |
| [`football.csv`](../sample/formats/football.csv) | Positions, height, preferred foot, goals and assists. |
| [`kabaddi.csv`](../sample/formats/kabaddi.csv) | Raid and tackle points, height and weight. |
| [`esports.csv`](../sample/formats/esports.csv) | Handles instead of names, K/D and ADR, string IDs like `P01`. |
| [`non-sport-quiz-league.csv`](../sample/formats/non-sport-quiz-league.csv) | An office quiz league. No sport anywhere — it still works. |
| [`google-form-responses.csv`](../sample/formats/google-form-responses.csv) | What a Forms response sheet really looks like. See [GOOGLE-FORMS.md](GOOGLE-FORMS.md). |

Every one of these is loaded and rendered by `node scripts/selftest.mjs` on each commit, so they can't drift out of date.

## How a column becomes part of the card

Each column is given a **role**. AuctionBook guesses; you can change any of them in the Columns panel.

| Role | Goes where | Header words that trigger it |
| --- | --- | --- |
| **Name** | The big line on the card | `name`, `player`, `handle` |
| **Lot / ID** | The number on the photo corner | `s.no`, `lot`, `id`, `reg no`, `#` |
| **Photo** | The picture | `photo`, `image`, `pic`, `headshot` |
| **Category** | Splits the booklet into sections | `category`, `role`, `position`, `type`, `set`, `grade` |
| **Base price** | Highlighted, and listed in the index | `base price`, `reserve`, `starting bid` |
| **Team** | Under the name | `team`, `club`, `franchise`, `department`, `college` |
| **Subtitle** | The small line under the name | `age`, `city`, `height`, `weight`, `style`, `nationality` |
| **Badge** | A pill on the card | `icon`, `marquee`, `captain`, `retained`, `overseas`, `seed` |
| **Stat** | The number tiles | **anything else numeric** |
| **Note** | Small print at the bottom | `remarks`, `notes`, `about`, `bio`, `achievements` |
| **Hide** | Nowhere | see *Privacy* below |

**The important one is Stat.** Any column that isn't recognised and holds mostly numbers becomes a stat tile labelled with your own header. That is the whole trick behind supporting any sport: AuctionBook does not know what a "Super Raid" is, and does not need to.

### Privacy

Columns that look personal are set to **Hide** automatically and never reach the page:

`phone` · `mobile` · `whatsapp` · `email` · `address` · `date of birth` · `aadhaar` · `PAN` · `account` · `IFSC` · `UPI` · `password`

So are columns that are about running the event rather than about the player: `Timestamp`, `Score`, `T-shirt size`, `payment`, `transaction`, `consent`, `availability`, `how did you hear about us`.

You can override any of it — but a booklet gets photographed and forwarded, so think before you un-hide a phone number.

## Getting the most out of it

**Put units in the header, not the cell.** `Height (cm) → 178` reads better than `Height → 178 cm`, and only the first sorts numerically. Text in a numeric column is printed as-is, so `Base Price → Negotiable` is fine.

**One fact per column.** `Batting Style` and `Bowling Style` as two columns give you two subtitle chips; `Style → "RHB / Right-arm fast"` gives you one long line.

**Keep stat headers short.** Tiles are about twelve characters wide and print in caps. `SR` beats `Strike Rate (career)`. Long headers are trimmed automatically — `Matches played (approx.)` becomes `Matches played` — but you get the last word by editing the label.

**Mind how many stats you have.** A card fits **9** stats at 1–2 per page, **6** at 4–6, and **4** at 8–9, in spreadsheet order. Extra columns aren't lost, just not printed — set the ones you don't want to **Hide** so the right four make the cut.

**Yes/No badge columns work.** A column called `Captain` holding `Yes` prints a pill reading **CAPTAIN**. Holding `Marquee` it prints **MARQUEE**. Blank prints nothing.

## Things that will trip you up

| Problem | What happens | Fix |
| --- | --- | --- |
| A title row above the headers | Row 1 is read as headers | Set **Header row** to 2 in the Data panel |
| Merged cells | Only the first cell keeps the value | Unmerge, then fill down |
| A `TOTAL` row at the bottom | Becomes a player called "TOTAL" | Delete it |
| Two header rows | The second becomes a player | Merge them into one row |
| Blank rows in the middle | Skipped silently — that one's fine | — |
| Duplicate header names | Second becomes `Runs (2)` | Rename so you can tell them apart |
| Numbers stored as text | Sorting goes alphabetical | Format the column as Number in Excel |
| Photos pasted *into* cells | Not readable — Excel keeps them floating above the grid | Use a photo folder or a URL column |

## Photos

Three ways, in order of how well they work:

1. **A folder of images** — the Data panel's photo picker. Files are matched by name: `ravi-kumar.jpg` → "Ravi Kumar", `12.png` → lot 12. Case, spaces, hyphens and underscores are ignored, and a file named `Ravi Kumar - IMG_2231.jpg` still matches. Images are shrunk in the browser, so they embed in the shared file and work offline. **This is the one to use.**
2. **A column of image URLs** — map it to **Photo**. Google Drive links are rewritten automatically to a form that actually renders. The images load over the network, so the shared `.html` needs a connection to show them.
3. **No photos** — cards fall back to the player's initials, which looks deliberate rather than broken.

## Multiple sheets

If your workbook has several sheets, pick one in the Data panel. A common pattern is `Players` plus a `Teams` sheet — AuctionBook reads players from the sheet you choose, and teams are typed into the Teams panel as `Name, Purse`, one per line.
