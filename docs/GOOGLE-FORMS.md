# Collecting players with a Google Form

A form is the natural front end for AuctionBook: players register themselves, Google collects the answers in a sheet, and that sheet is exactly what the booklet builder eats.

Total time: about fifteen minutes to build the form, thirty seconds per booklet afterwards.

---

## 1 · Create the form

1. Go to **[forms.new](https://forms.new)**.
2. Name it after the event — `Riverside Premier League — Player Registration`.
3. Add a description with the three things people always ask: the auction date, the entry fee, and the last date to register.

## 2 · Add the questions

Copy these. The wording matters less than the *shape* — AuctionBook reads the header, so a question that starts with the noun you want on the card gives you a clean label.

| # | Question | Type | Required | Becomes |
| --- | --- | --- | --- | --- |
| 1 | Full name (as it should appear in the booklet) | Short answer | ✅ | **Name** |
| 2 | Mobile number | Short answer | ✅ | *Hidden — organisers only* |
| 3 | Category | Multiple choice | ✅ | **Category** — the booklet's sections |
| 4 | Age | Short answer | | Subtitle |
| 5 | City / locality | Short answer | | Subtitle |
| 6 | Base price | Multiple choice | ✅ | **Base price** |
| 7 | *…your sport's stats — see below* | Short answer | | **Stat tiles** |
| 8 | Upload a recent photo | File upload | | **Photo** |
| 9 | Anything the team owners should know about you? | Paragraph | | Note on the card |

**Set question 3's options to your actual categories** — these become the sections of the printed booklet, so `Batter / Bowler / All-rounder / Wicket-keeper` for cricket, `Raider / Defender / All-rounder` for kabaddi. Use *Multiple choice*, never *Short answer*: free text gives you `batsman`, `Batsman`, `BATTER` and `bat` as four different sections.

Same for question 6. Offer three or four fixed price bands rather than letting people type a number.

### The stat questions, by sport

Add these as **Short answer** with *Response validation → Number*. Four to six is the sweet spot — a printed card fits six.

**Cricket** — Matches played · Runs scored · Wickets taken · Batting average · Strike rate
**Football** — Appearances · Goals · Assists · Clean sheets (goalkeepers)
**Kabaddi** — Matches played · Raid points · Tackle points · Super raids · Super tackles
**Volleyball** — Matches played · Spikes · Blocks · Aces · Height (cm)
**Basketball** — Games · Points per game · Rebounds · Assists
**Badminton / TT** — Current ranking · Matches played · Wins · Titles
**Esports** — Matches · K/D · ADR · Headshot % · Current rank

Put the unit in the question, not the answer: ask **"Height (cm)"**, so people type `178` and not `5'10"`.

## 3 · Settings that matter

Open **⚙ Settings**:

- **Responses → Collect email addresses** — on. You'll want to reach people about payment.
- **Responses → Limit to 1 response** — on if your players have Google accounts. It stops duplicate entries, but forces sign-in.
- **Presentation → Confirmation message** — tell them what happens next: *"You're registered. The auction booklet goes out on 10 March."*

⚠️ **A File upload question forces everyone to sign in to a Google account.** If your players are a WhatsApp group of local club cricketers, that will cost you registrations. Consider dropping the upload and collecting photos over WhatsApp instead — see *Photos* below.

## 4 · While registration is open

Click **Responses → View in Sheets** once, to create the linked spreadsheet. Leave it open; it fills in live.

Before you build the booklet, spend five minutes in that sheet:

- Fix obvious typos in names — they're going in print.
- Delete test entries and duplicates.
- Sanity-check the stats. Someone always claims 400 wickets.

Don't bother deleting the Timestamp, email or phone columns. AuctionBook hides them for you.

## 5 · Photos — read this bit

This is where people lose an evening.

Google Forms does **not** put an image in the sheet. It puts a link to a Drive file, like `https://drive.google.com/open?id=1AbCdEf…`. That link is a *web page*, not an image — dropped into a booklet it renders as a broken picture. And by default those files are private to you, so nobody else could load them anyway.

Two ways out.

### The reliable one — download the folder

1. In Drive, open the folder the form made (it's named after your form).
2. **Right-click the folder → Download.** Google zips it.
3. Unzip it. The files are named `Arjun Menon - IMG_2231.jpg`.
4. In AuctionBook, use **Player photos** in the Data panel and select all the images.

AuctionBook matches `Arjun Menon - IMG_2231.jpg` to the player *Arjun Menon* on its own — you don't need to rename anything. The images are shrunk and embedded, so the shared booklet works offline. **Do this one.**

### The other one — leave them in Drive

1. Right-click the uploads folder → **Share** → *General access* → **Anyone with the link** → *Viewer*.
2. In AuctionBook, map the upload column to **Photo**.

AuctionBook rewrites the Drive link into a form that actually renders. But the photos then load over the network, so the shared `.html` shows them only when the reader is online, and only while that folder stays shared. Fine for a quick preview; not what you want for the file you send to a hundred people.

## 6 · Build the booklet

1. In the responses sheet: **File → Download → Microsoft Excel (.xlsx)**.
   *(Or **Comma-separated values** — either works.)*
2. Open **[the AuctionBook app](https://hedaprateek.github.io/auction-booklet/)** and drop the file in.
3. Check the **Columns** panel. The name, category and base price should already be right; fix anything that isn't and shorten any stat label you don't like.
4. Add photos, your logo, the teams and the rules.
5. **Share booklet ↓** for the file you send everyone, **Print / PDF** for the copies on the table.

Want to see it before you build your own form? [`sample/formats/google-form-responses.csv`](../sample/formats/google-form-responses.csv) is a real response sheet, traps included — drop it straight into the app.

---

## Reusing the form next season

Open the form → **⋮ → Make a copy**. Change the title and the dates, and clear the old responses sheet. Your questions, categories and price bands come along.

If you saved the booklet as a **project file** (`Save project` in AuctionBook), open that too — your colours, logo, layout and rules page come back exactly as they were, and you only swap in the new player list.
