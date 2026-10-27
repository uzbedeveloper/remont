# Remont: one-page spec

**Film your room. Get a fair smeta. Hire the right ustas.** All in one flow, in Uzbek and Russian.

Meta Global AI Developer Hackathon, track **Build for Your World**. Build window Oct 27 to Nov 4 2026. Submit by **Nov 4, 9:00 PM ET (Nov 5, 07:00 Tashkent)**. Our own deadline: **Nov 4, 20:00 Tashkent**.

---

## 1. The problem (the pitch line)

> People in Tashkent pay for a renovation they can't measure, to workers they find by luck.

- A family gets a quote from an usta. Nobody knows the real square meters, so nobody can tell whether it's fair.
- Finding workers means asking relatives or scrolling Telegram job groups. Every job post is written by hand, says almost nothing ("kafel kerak, tel qiling") and gets 40 messy replies.
- When the family member paying is abroad (millions of Uzbeks work abroad; check the exact figure before the pitch), they can't see the flat at all.

## 2. Why this isn't another AI interior design app

| Others | Stop at | Remont goes on to |
|---|---|---|
| AI interior design (Remo, RoomGPT-style) | A pretty render | A measured, priced smeta |
| Quote checkers (RemodelerIQ, Quoterly; US only) | Checking a quote you already have | Making the quote yourself, from video |
| Worker marketplaces (Profi.ru, YouDo, OLX, Telegram groups) | You write the job and guess the scope | The job writes itself from the smeta, per trade, with exact areas |

In the #build-for-your-world channel, nobody is doing construction, Central Asia, or Uzbek and Russian. **Don't** pitch "every number has a receipt"; half the channel does that. Show it once, quietly.

## 3. The flow (5 screens, mobile-first web)

1. **Film**: a 30–60 s walk around the room. Optional one-line brief: "kafel, yangi pol, oq devor". It's typed or picked from chips; voice is a stretch goal (see risks).
2. **Measure**: SAM 3.1 tracks the walls, floor, ceiling, door, window and radiator through the video. Spark measures with the standard Soviet door as a ruler, and the user can correct one size ("the door is 2.0 m"). Output: measured surfaces, with each mask shown over the video.
3. **Smeta**: a Spark agent turns the surfaces and the brief into a priced smeta in **crew order** (demolition → electrics → plaster → screed → tiles → paint). Prices come from **our curated, dated Tashkent price base**, never from random web pages. Total, per-step cost and timeline.
4. **Jobs**: the smeta splits into **trade jobs**: electrician, plasterer, tiler, painter. Each job card has the exact area, materials (who buys them), price range, start day ("tiler from day 6") and photos with that surface highlighted.
5. **Hire**, two ways on the same screen:
   - **Matching ustas**: a ranked list filtered by trade, district, price and rating, each with one "why this one" line.
   - **Announce**: one tap posts a clean ad in Uzbek and Russian to our Telegram job group. The bot collects the replies, Spark reads them (any mix of Latin, Cyrillic and Russian), pulls out price, start date and experience, **compares each price with the fair range from the smeta**, and shows a short list: "fair / 18% high / too vague".

**Ending shot:** Muse Image renders *the same room* renovated, so the family and the usta see the same goal. 5 seconds, not the main point.

## 4. Meta models and their jobs

| Model | Job |
|---|---|
| **SAM 3.1** (video) | Tracks surfaces and openings through the walk-around; gives the masks that get measured and highlighted on job cards |
| **Muse Spark** | Measuring (vision + reasoning), smeta agent (tools + strict JSON schema), smeta → trade jobs, writing the job ads, parsing worker replies, the fair-price check |
| **Muse Image** (edit) | The same room, renovated |
| **Muse Wonder** (stretch) | Remembers the project: follows up with shortlisted ustas, tracks who confirmed |
| Muse Voice Transcribe | Not used for Uzbek (unsupported). Stretch: Spark 1.2 audio for the brief |

Only Meta models are called at runtime. Claude Code is only a build tool.

## 5. Build

- **Stack:** Next.js on Vercel (long function timeouts), Telegram bot on a Vercel webhook, files in Vercel Blob, project state in Upstash Redis (KV). One repo, and judges can run it with one `.env`.
- **Price base:** `data/prices_tashkent_2026-10.json`, about 60 work and material lines (per m², per point, per piece). The source and date are on each line, collected by hand from markets and ustas this week.
- **Ustas:** `data/ustas.json`, about 20 profiles. The demo list is **clearly labeled as sample data**. Real ustas can join through the bot: `/start` → trade, district, price, 3 photos of past work.
- **Reuse from the spike:** `sam.mjs`, `measure.mjs`, `smeta.mjs`, `renovate.mjs` (all working on 26 Oct).

## 6. Day plan

| Day | Goal | Done when |
|---|---|---|
| **Tue 27** | Spec, repo scaffold, **real footage collected** | The repo is public and the real room video is in |
| **Wed 28** | Measure from the real video | Within ±10% of tape on the main walls |
| **Thu 29** | Price base + smeta agent on it | The smeta for the real room looks right to a real usta |
| **Fri 30** | Trade jobs + usta matching | 4 job cards with highlighted surfaces |
| **Sat 31** | Telegram: post, collect, parse, shortlist | A friend's reply shows up ranked as "fair" or "high" |
| **Sun 1** | UI polish, Uzbek + Russian, render | It runs end-to-end on a phone |
| **Mon 2** | Full run on the real flat, fix everything | Two clean runs in a row |
| **Tue 3** | Record the video, README, repo clean-up | The video is cut |
| **Wed 4** | Buffer → **submit by 20:00 Tashkent** | The repo opens logged out and the video is uploaded |

Rule: if a day slips, the stretch goals go first (voice, Wonder, usta self-signup), never the core flow.

## 7. The 3-minute video

The numbers below are placeholders. The real ones come from the real room.

| Time | Shot |
|---|---|
| 0:00–0:15 | A message from mom: an old Soviet room, peeling walls. Son in Seoul: "How much will it cost? Who will do it?" Title: **Remont**. |
| 0:15–0:40 | Mom films the room for 40 s. The masks light up over the walls, floor and window as she walks. |
| 0:40–1:05 | Measurements appear: walls 41 m², floor 12 m². One tap fixes the door height. |
| 1:05–1:35 | The smeta builds itself in crew order. Total: 15.2M so'm, 18 days. |
| 1:35–2:00 | The smeta splits into 4 job cards. The tiler card highlights exactly the bathroom walls. |
| 2:00–2:35 | One tap → the ad appears in the Telegram group in Uzbek. Real replies come in. The shortlist: "Akmal: fair, starts Monday", "Botir: 22% high". |
| 2:35–2:50 | The same room, renovated. Mom sees it. |
| 2:50–3:00 | "Film your room. Fair smeta. The right ustas." Repo link. |

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Measurements from the video are off | The user enters one known size; we show the measurement range honestly |
| SAM misses peeled-wall areas | Measure the wall plane from its corners and openings, not from the paint |
| Uzbek voice isn't supported | Typed brief + chips; Spark audio only if it works on day 6 |
| No real workers on camera | Our own Telegram group plus 3 friends replying as real ustas (they're real people, the replies are real) |
| Posting into big public job groups | Out of scope: bots can only post where they're added. The demo uses our group |
| Smeta prices look wrong to a local | The curated base, checked by one real usta before the video |

## 9. What Umarxon needs to get (this decides the win)

1. **The real room:** a 60 s walk-around video, plus tape measurements of 3 walls, the floor, the door and the window.
2. **One real usta** to look over the price base and the final smeta (30 min).
3. **A Telegram group** for jobs, plus **3 friends** who'll reply to the ad as workers.
4. Optionally, **mom on camera** for the opening and the render reaction.

## 10. Not doing

Payments, contracts, usta ratings from real reviews, native apps, material shopping, multi-room projects. These go on the "what's next" slide.
