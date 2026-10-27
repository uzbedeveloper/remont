# Remont feasibility spike (26 Oct 2026)

Throwaway tests to decide go / no-go on Remont. Key is read from `MODEL_API_KEY` (env or HKCU registry).

| Script | Tests | Result on stand-in photo (`out/standin_room.jpg`, Muse Image generated) |
|---|---|---|
| `sam.mjs <photo/video> [prompts]` | SAM 3.1 finds door/window/wall/floor/ceiling/radiator | ✅ all found, conf 0.62–0.97, ~4–6 s per prompt. Heavily peeled wall areas partly missed |
| `renovate.mjs <photo> [brief]` | Muse Image edits the *same* room | ✅ same geometry, same view out the window, new finishes. ~46 s |
| `measure.mjs <photo/video> [hint]` | Muse Spark measures using the Soviet door as a ruler | ✅ plausible 3.4 × 3.0 × 2.6 m, JSON as asked, ~11 s. **Accuracy unknown until the real tape-measured room** |
| `sam.mjs out/fake_walk.mp4 …` | SAM tracking on video (10 s pan made from the stand-in) | ✅ door/window/radiator/floor each kept ONE id across all 50 frames (5 fps). ~30 s per prompt per 10 s clip → run prompts in parallel |
| `smeta.mjs <measure.json> [brief]` | Spark + web_search (UZ/Tashkent) + strict json_schema → priced work→materials smeta | ✅ 12–13 steps in crew order, waste margins, norms, totals add up exactly. 14.4M and 16.6M UZS on two runs, ~57 s, 18 searches, ~$0.45 a run. ⚠️ web "sources" are junk (a GitHub README, all.biz) → need our own curated, dated Tashkent price base |
| (todo) voice | Uzbek speech → brief | Voice Transcribe has **no Uzbek/Russian** (25 langs, Turkish yes). Try Muse Spark 1.2 audio input, and Transcribe with a Turkish bias |

Open: SAM on a real phone video (tracking across frames), measurement accuracy vs tape, Uzbek voice.
