# Submission text (copy into the form)

## Name
Remont

## Tagline (one line)
Film your room while you talk: Remont measures it, prices the renovation fairly, shows it finished, and finds real contractors. In Uzbek, Russian and English.

## Track
Indie developer track. Theme: Build for Your World.

## Links
- Live: https://remontchi.uz
- Repo: https://github.com/uzbedeveloper/remont
- Video: _add_

## The problem
In Uzbekistan there is no price list for renovation. Contractors (ustas) advertise in more than 200 Telegram groups, almost never with a price for the owner: of 50 627 ads we read, fewer than 40 had one. Owners can't measure the room themselves, get three quotes that differ by 2x, and sign handwritten papers nobody checks. People overpay, or run out of money halfway.

## What it does
You open Remont in the phone browser, film the room once and say what you want, in Uzbek or Russian. In about 13 seconds you get:

1. **A measured room.** SAM 3.1 tracks walls, floor, ceiling, doors and windows through the video; Muse Spark turns them into metres using the standard door as a ruler. The app draws the floor plan to scale and all four walls unfolded.
2. **A fair estimate.** Spark picks the works and quantities from a fixed catalog, in crew order. Code prices every line from a dated Tashkent price base, so the AI never invents a price and the totals always add up. Economy, standard and premium switch instantly.
3. **Your own room, finished.** Muse Image repaints the real room in the chosen style and colour. In Premium every style is drawn ahead in the background, so a tap is instant.
4. **No forms.** A voice assistant (Spark 1.2 hears, Spark 1.3 decides) runs actions: "I have 20 million" fits the plan to the budget, "make the walls blue" repaints, "I paid the electrician 300 000" goes into the payment notebook. Every change can be undone.
5. **Check a contractor's quote.** Photograph a handwritten quote; Spark reads every line, code checks quantities against the measured room and prices against the base, and Spark drafts a polite counter-offer.
6. **Hire and track.** 1 027 real Tashkent contractors, read by Spark from 50 627 public ads in 243 Telegram groups and OLX. A plan per trade (talked → agreed → working → done), a one-page agreement, a check before you pay, receipts. A Database page lists all of them plus 589 renovation stores Spark found in 529 Telegram store channels and marketplace groups.

## How we used Meta's models
- **SAM 3.1** (video): surface tracking through the walk-around; masks highlight the surface behind each estimate line.
- **Muse Spark 1.3**: measuring from video, the work plan (strict JSON schema), voice actions, reading handwritten quotes, counter-offers, job posts, sorting 50 627 ads into a contractor directory, reading 1 672 posts with prices to check the price base.
- **Muse Spark 1.2**: hearing Uzbek and Russian speech, from voice notes and from the video's own sound track (Voice Transcribe doesn't support Uzbek).
- **Muse Image 1.0**: same-room renovation edits, styles, colours, follow-up edits, Premium pictures drawn ahead.

Only Meta models are called at runtime. Low and minimal reasoning effort gave the same estimate in 9 s instead of 24 s.

## Technical depth
- Models see and understand, code counts: all money math is deterministic (`lib/estimate.mjs`).
- The price base is checked against reality: Spark read 1 672 Telegram posts that name a price per unit, separated prices from job sizes and wholesale crew rates from offers to owners; code compares the medians (`scripts/prices_check.mjs`).
- Analysis is split so the owner waits ~13 s: Spark measures from a light 2 fps copy while SAM, the first estimate and the first picture run in the background.
- Premium drawing ahead: 8 pictures per room, two workers, reused when the prompt still matches, redrawn when the tier or look changes.
- Live on a 1-CPU server: the phone video is decoded once into both model copies; per-visitor daily limits and a site-wide cap protect the key; every push to master deploys itself through a key that can only run the update script.

## What's next
We launch in Tashkent first, at remontchi.uz. The basic version stays free for everyone; Premium (everything instant) pays for the servers. Then Samarkand, Bukhara and the rest of Uzbekistan, with price bases checked by local contractors in each city.

## Built during the hackathon
Everything was written from 26 Oct 2026 after kickoff; the git history shows each step. Solo build by Murodxonov Umarxon, Tashkent. Claude Code was used as a coding tool; the app calls only Meta models.
