# Remont

**Film your room while you talk. Get a fair smeta, see it finished, call a real usta, and track the work to the end.** In Uzbek, Russian and English, phone first.

Built for the Meta Global AI Developer Hackathon 2026 (track: Build for Your World). All code in this repo was written during the build window, starting 26 Oct 2026 after kickoff. `spike/` holds the first feasibility tests from that night.

Words: an **usta** is a tradesperson or contractor (plasterer, tiler, electrician); a **smeta** is a renovation estimate. The app says "contractor" and "estimate" in English mode, and its voice assistant is called the Foreman there.

## Why

Renovating a flat in Tashkent means guessing: how many m² the usta will charge for, whether 60 000 so'm per m² is fair, who to call. Owners sign handwritten quotes they can't check. Remont measures the room, prices the work from a fixed price base, finds real ustas and keeps the job on track.

## What it does

1. **Film and talk.** Walk around the room with your phone and say what you want ("potolok 2.7, devorni oq qilamiz, arzonroq bo'lsin"). **Muse Spark 1.2** hears the sound track; sizes you say are taken as ground truth, wishes pre-fill the smeta.
2. **Measure.** **Muse Spark** measures the room from the video, using the standard Soviet door and ceiling as rulers. **SAM 3.1** tracks walls, floor, ceiling, door, window and radiator through every frame (in the background, so the owner waits ~13 s, not a minute). Every size can be corrected.
3. **Smeta.** Muse Spark picks the works and quantities from a fixed catalog in crew order. **It never prices anything**: money comes from `data/prices_tashkent.json` and is computed in code (`lib/estimate.mjs`), so totals always add up and economy/standard/premium switch instantly.
4. **See it finished.** **Muse Image** repaints the same room with the chosen finishes. Each style card shows a real picture of that style (made once by Muse Image from the sample room, `scripts/style_previews.mjs`); tap one, or a wall colour, and it repaints your room in one tap; every version is kept.
5. **Talk to it ("Usta").** Hold the mic and talk (release to send), or tap once and talk: it sends when you stop. Say "devorni havorang qil", "arzonroq variant", "kafelchi kerak". Spark 1.2 hears, Spark 1.3 turns it into actions (repaint, change tier, fix a size, rebuild the smeta, write a job post, update the plan). The reply shows in ~4 s; the new picture follows.
6. **Check an usta's quote.** Photograph a handwritten quote. Spark reads every line (Uzbek, Russian, slang, "45к", "kv"); code checks each quantity against the measured room and each price against the base, finds arithmetic mistakes and missing works, and Spark drafts a polite reply with the numbers.
7. **Call a real usta.** 670 Tashkent ustas gathered from 23 826 ads in 203 public Telegram groups and OLX.uz; Muse Spark sorted ustas from employers and shops, and read their trades, districts and experience. One tap to call or open Telegram (the job description is copied for you).
8. **Track it to the end.** The plan shows every trade in work order: need an usta → talked → agreed (price checked against the fair range) → working → done, with photos of the result. One line always says what to do next.

## Meta models used

| Model | Where |
|---|---|
| Muse Spark 1.3 | measuring, smeta plan, Usta's decisions, quote reading, job posts, worker replies, polite counter-offer, usta directory |
| Muse Spark 1.2 | hearing speech (voice notes and the video's sound track) |
| SAM 3.1 | tracking surfaces through the video |
| Muse Image 1.0 | the renovated room, styles, follow-up edits |

Only Meta models are called at runtime. Spark runs with low or minimal reasoning effort: on our prompts it gave the same smeta in 9 s instead of 24 s.

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

## The usta directory

`data/ustas_directory.json` is built from public ads, where ustas post their phone numbers to find clients:

```bash
node scripts/ustas_tg.mjs      # reads public Telegram renovation groups (needs a Telegram login: scripts/tg_login.mjs)
node scripts/ustas_olx.mjs     # OLX.uz renovation services in Tashkent (slow on purpose; OLX blocks fast clients)
node scripts/ustas_build.mjs   # Muse Spark reads the ads and writes the directory
```

Remont has not vetted these ustas; the app says so and suggests asking for photos of past work and paying in stages.

## Code map

- `server.mjs` one Node process: API + app (Vite in dev, `dist/` in prod)
- `lib/api.mjs` routes; `lib/agents.mjs` every vision/image call; `lib/voice.mjs` hearing and Usta; `lib/meta.mjs` the Meta API client
- `lib/estimate.mjs` all money math; `lib/look.mjs` finishes, styles, colours; `lib/board.mjs` the plan; `lib/ustas.mjs` phones and ranking
- `src/screens/` Home, Analyze, Measure, Smeta, Check, Plan, Hire; `src/components/Talk.jsx` the voice dock

## Notes

- The price base is a **draft** and is being checked by a working Tashkent usta.
- `data/ustas.json` holds sample profiles used only when the directory is missing.
