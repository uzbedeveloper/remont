# Remont

**Film your room. Get a fair smeta. Hire the right ustas.** In Uzbek, Russian and English.

Built for the Meta Global AI Developer Hackathon 2026 (track: Build for Your World). All code in this repo was written during the build window, starting 26 Oct 2026 after kickoff. `spike/` holds the first feasibility tests from that night.

## What it does

1. **Film**: upload a 20-40 s walk-around video of a room (or a photo).
2. **Measure**: **SAM 3.1** tracks walls, floor, ceiling, door, window and radiator through every frame; **Muse Spark** measures the room using the standard Soviet door as a ruler. The owner can correct any size and everything recalculates.
3. **Smeta**: Muse Spark plans every work item in crew order from a fixed catalog. **It never prices anything**: money comes from `data/prices_tashkent.json` and is computed in code (`lib/estimate.mjs`), so the totals always add up and switching economy/standard/premium is instant.
4. **Jobs**: the smeta splits into one job per trade (electrician, plasterer, tiler…) with exact quantities, schedule and a fair labor range.
5. **Hire**: matching ustas, plus a Telegram job post written by Muse Spark in Uzbek and Russian. Paste the workers' replies and Muse Spark reads them (mixed languages, slang, "85 ming", "под ключ"); code compares each quote with the fair price of exactly the lines it covers.
6. **See it finished**: **Muse Image** repaints the same room with the chosen finishes.

## Run it

Needs Node 20+ and `ffmpeg` on the PATH.

```bash
npm install
cp .env.example .env   # add MODEL_API_KEY
npm run dev            # http://localhost:5173
```

Click **Try the sample room** to see a finished project without spending API credits.

## Notes

- The price base is a **draft** and is being checked by a working Tashkent usta.
- Usta profiles in `data/ustas.json` are **sample data** for the demo.
- Only Meta models are called at runtime.
