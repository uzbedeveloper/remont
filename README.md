# Remont

**Film your room while you talk. Get a fair smeta, see it finished, call a real usta, and track the work to the end.** In Uzbek, Russian and English, phone first.

- **Live:** https://remontchi.uz
- **Demo video (2:53):** https://www.youtube.com/watch?v=RlLvclp8NEU
- **Track:** Build for Your World, Indie developer track, Meta Global AI Developer Hackathon 2026

Words: an **usta** is a tradesperson or contractor (plasterer, tiler, electrician); a **smeta** is a renovation estimate. The app says "contractor" and "estimate" in English mode, and its voice assistant is called the Foreman there.

## For judges: try it in one minute

1. Open the live site on a phone or a laptop, tap **Try the sample room**. It is a real room, filmed and analysed by the Meta models; opening it costs nothing.
2. **Smeta**: switch economy / standard / premium, tap a line to see its surface light up on the drawing.
3. **Premium** switch, then tap any style: the picture appears at once (it was drawn ahead).
4. Hold the mic and say "I have 20 million" (or "menda 20 million bor"): the smeta fits the budget.
5. **Check a quote** and **Plan** show the rest of the job.

To try your own room, film 20 to 40 s slowly around it and talk while you film. The public site has a small daily allowance per visitor, so the API key can't be spent by strangers.

## Why

Renovating a flat in Tashkent means guessing. There is no price list. Ustas post in more than 200 Telegram groups, almost never with a price for the owner (of 50 627 ads we read, fewer than 40 did; prices go to private chats). Owners sign handwritten quotes they can't check, so they overpay or run out of money halfway. Remont measures the room, prices the work from a fixed price base, finds real ustas and keeps the job on track.

## What it does

1. **Film and talk.** Walk around the room with your phone and say what you want ("potolok 2.7, devorni oq qilamiz, arzonroq bo'lsin"). **Muse Spark 1.2** hears the sound track; sizes you say are taken as ground truth, wishes pre-fill the smeta.
2. **Measure.** **Muse Spark** measures the room from the video, using the standard Soviet door and ceiling as rulers. **SAM 3.1** tracks walls, floor, ceiling, door, window and radiator through every frame (in the background, so the owner waits ~13 s, not a minute). Every size can be corrected. Spark also says which wall each door and window is on, and the app draws the room: the plan from above to scale and the four walls unfolded with their net m² (`lib/drawing.mjs`). Tap a smeta line and its surface lights up on the drawing.
3. **Smeta.** Muse Spark picks the works and quantities from a fixed catalog in crew order. **It never prices anything**: money comes from `data/prices_tashkent.json` and is computed in code (`lib/estimate.mjs`), so totals always add up and economy/standard/premium switch instantly.
4. **See it finished.** **Muse Image** repaints the same room with the chosen finishes. Each style card shows a real picture of that style; pick one and a wall colour; every version is kept.
   - **Free:** the picture is drawn when you pick a style (about 20 s).
   - **Premium:** while you read the smeta, the server draws all 6 styles in your colour, plus your style in 2 more colours, two at a time (`prerender` in `lib/api.mjs`). A tap shows the picture at once, marked ⚡ ready. Pictures whose prompt still matches are reused, and the set is redrawn only when the tier, finishes or look change.
5. **Talk to it ("Usta").** Hold the mic and talk (release to send), or tap once and talk: it sends when you stop. Say "devorni havorang qil", "arzonroq variant", "kafelchi kerak". Spark 1.2 hears, Spark 1.3 turns it into JSON actions the server runs: repaint, change tier, fix a size, move a door on the drawing, rebuild the smeta, fit a budget ("menda 20 mln bor"), pick a style and colour, tick the shopping list ("gipsni oldim"), record a payment ("elektrikka 300 ming avans berdim"), mark a check, write a job post, update the plan. Every change can be undone from the chat. The reply shows in ~4 s; the new picture follows.
6. **Check an usta's quote.** Photograph a handwritten quote. Spark reads every line (Uzbek, Russian, slang, "45к", "kv"); code checks each quantity against the measured room and each price against the base, finds arithmetic mistakes and missing works, and Spark drafts a polite reply with the numbers.
7. **Call a real usta.** 1 027 Tashkent ustas gathered from 50 627 ads in 243 public Telegram groups and OLX.uz; Muse Spark sorted ustas from employers and shops, and read their trades, districts and experience. One tap to call or open Telegram (the job description is copied for you).
8. **Browse the whole database.** The Database page (#/browse) lists every usta and 589 renovation stores (materials, tiles, plumbing, electrical, doors, furniture, tool rental) that Muse Spark found in 297 store channels and 232 marketplace groups, with search and district filters.
8. **Made for real owners.** Type your budget and the smeta fits it (the best tier that fits; ceiling, windows, floor and tiles move to later only when needed; wiring, pipes and walls never wait). A bozor shopping list grouped by trade and day, sent to Telegram. One picture of the room now and finished, with the total, for the family chat. An Aa text size switch, with an easy mode with bigger text for parents.
9. **Track it to the end.** The plan shows every trade in work order: need an usta → talked → agreed (price checked against the fair range) → working → done, with photos of the result. One line always says what to do next. Each trade has a one-page agreement for the usta (price, dates, payment stages, guarantee; sent on Telegram), a check before you pay (four plain tests per trade, like a 2 m straight edge on the wall), and a payment notebook with receipt photos.

## Meta models used

| Model | Where |
|---|---|
| Muse Spark 1.3 | measuring, smeta plan, Usta's decisions, quote reading, job posts, worker replies, polite counter-offer, usta directory |
| Muse Spark 1.2 | hearing speech (voice notes and the video's sound track, Uzbek and Russian) |
| SAM 3.1 | tracking surfaces through the video |
| Muse Image 1.0 | the renovated room, styles, colours, follow-up edits, Premium pictures drawn ahead |

Only Meta models are called at runtime. Spark runs with low or minimal reasoning effort: on our prompts it gave the same smeta in 9 s instead of 24 s.

**The rule behind it: models see and understand, code counts.** Spark decides *what* work a room needs and reads messy quotes; every so'm is computed in code from a dated price base, so the AI can't invent a price and the totals always add up.

## Run it

Needs Node 20+ and `ffmpeg` on the PATH.

```bash
npm install
cp .env.example .env   # add MODEL_API_KEY
npm run dev            # http://localhost:5173
```

Click **Try the sample room** to see a finished project without spending API credits.

**On a phone** (camera and mic need https): `npm run phone` builds the app, opens a temporary Cloudflare tunnel and prints a QR code. Needs `cloudflared` installed.

**On a phone on the same Wi-Fi** (no internet tunnel): `npm run lan` serves https on this computer's Wi-Fi address with a self-made certificate and prints a QR code. The phone warns once that the connection is not private; tap Advanced → continue.

## The live site

The public site runs on one small DigitalOcean server (Ubuntu 24.04): Node 22, ffmpeg, Caddy for automatic HTTPS, a systemd service. `deploy/setup.sh` sets up a fresh server in one command.

- **Auto deploy:** every push to `master` runs `.github/workflows/deploy.yml`, which connects with an SSH key that can only run `deploy/update.sh` (pull, install only when the lockfile changed, build, restart, check `/api/health`).
- **Public mode** (`PUBLIC=1`, `lib/guard.mjs`): each visitor has a daily allowance per paid action, and the whole site has a daily cap on Meta API calls. `/api/health` shows today's count. Premium drawing ahead is off for visitors' own rooms on the public site; the sample room ships with every style already drawn, so Premium is instant there.
- **Small server tricks:** the phone video is decoded once and written as both the SAM copy and the Spark copy (`lib/media.mjs`), half the time on 1 CPU.

## The usta directory

`data/ustas_directory.json` is built from public ads, where ustas post their phone numbers to find clients:

```bash
node scripts/ustas_tg.mjs      # reads public Telegram renovation groups (needs a Telegram login: scripts/tg_login.mjs)
node scripts/ustas_olx.mjs     # OLX.uz renovation services in Tashkent (slow on purpose; OLX blocks fast clients)
node scripts/ustas_build.mjs   # Muse Spark reads the ads and writes the directory
node scripts/prices_check.mjs  # Muse Spark reads posts with prices; code compares them with the price base
```

Remont has not vetted these ustas; the app says so and suggests asking for photos of past work and paying in stages.

## Code map

- `server.mjs` one Node process: API + app (Vite in dev, `dist/` in prod)
- `lib/api.mjs` routes, background analysis, Premium drawing ahead; `lib/agents.mjs` every vision/image call; `lib/voice.mjs` hearing and Usta; `lib/meta.mjs` the Meta API client; `lib/guard.mjs` public limits
- `lib/estimate.mjs` all money math; `lib/look.mjs` finishes, styles, colours; `lib/board.mjs` the plan; `lib/ustas.mjs` phones and ranking; `lib/drawing.mjs` plan and wall drawings; `lib/media.mjs` ffmpeg
- `src/screens/` Home, Analyze, Measure, Smeta, Check, Plan, Hire; `src/components/Talk.jsx` the voice dock
- `deploy/` server setup, update script, systemd and Caddy files; `samples/demo` the finished sample room

## What's next

Remont launches in **Tashkent** first, at remontchi.uz. The basic version stays free for everyone: film, measure, smeta, pictures, quote check, plan. **Premium** is for people who want everything instant (every style drawn ahead), and it pays for the servers. Then Samarkand, Bukhara and the rest of Uzbekistan, with price bases checked by local ustas in each city.

## Built during the hackathon

All code in this repo was written during the build window, starting 26 Oct 2026 after kickoff; the git history shows every step. `spike/` holds the first feasibility tests from that night. Coding was done with Claude Code as a build tool; the app itself calls only Meta models.

## Notes

- The price base is a **draft**. `scripts/prices_check.mjs` checks it against real prices: Muse Spark read 1 672 Telegram posts that name a price per unit, told prices from job sizes ("3000 kv" is a volume), and matched them to catalog works (`data/prices_check.json`). Our labour prices sit above the wholesale rates foremen pay crews on big sites, as a single flat should, and close to what ustas ask owners; tiling, window slopes and screed look 30 to 50% high and are being reviewed.
- `data/ustas.json` holds sample profiles used only when the directory is missing.
