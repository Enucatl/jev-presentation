# Shared benchmark comparison

Collected2026-10-23. The deck uses **S1MB English v1**, a primary community benchmark with recorded native decision-model adapters, not GPT chat generation. The order is TypeSafe, GPT, AutoTrust. No inference was performed for this presentation.

The committed [snapshot](s1mb-snapshot.json) contains source URLs, exact aggregates, selected raw metrics, sample counts, model identities, dataset revisions and run settings. Primary sources:

- [Prepared viewer summary, pinned](https://huggingface.co/datasets/hotchpotch/s1mb-result/resolve/595f9f3e9921c3bcd9a7ee3155983eafd6491ca6/viewer-summary.json), generated2026-10-21, underlying result revision4259f921ae6f6e4b2943b6179eca2380ba1a5922.
- [Measurements at that revision](https://huggingface.co/datasets/hotchpotch/s1mb-result/tree/4259f921ae6f6e4b2943b6179eca2380ba1a5922).
- [Scoring specification](https://github.com/hotchpotch/S1MB/blob/9ad06feacc372af4a99beea0bf25a0bcaa1df5c4/evaluator/SCORING.md).
- [Luna submission and refusal handling](https://huggingface.co/datasets/hotchpotch/s1mb-result/commit/8f30ac80e3e71e8442ea2fabba8d324ca9da0ce6).
- [Official OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions): native endpoint accepts gpt-6-luna. S1MB uses that endpoint, not OpenRouter or chat.

## Full-suite table

All three entries cover137benchmarks (59Noul,57Choice,21Score) and26,269judgments. Values are baseline-adjusted scores0–100, not raw accuracy percentages. Benchmarks are adjusted and clipped individually, then averaged equally within each task. Task Avg equally weights the three task scores. It is not the roster-dependent Borda ranking.

Noul adjustment uses balanced accuracy, **not Brier skill**; this table does not establish overall probability calibration. Choice adjustment uses target mass at the selected answer relative to a constant baseline. Score adjustment uses normalized expected-value MAE relative to a constant baseline. Baselines are fit to evaluation targets according to the benchmark specification.

## Four shared Choice datasets

BANKING77, MASSIVE, CLINC and GSM8K are selected recognizable task examples, not an independently sampled representative subset. Raw target mass at the selected alternative is accuracy for these hard-label tasks. Samples have100,200,151,100decisions respectively; MASSIVE has100cases with two decisions per case. Results are rounded to one decimal percent. Input-hash dictionaries for each of the four benchmarks are identical across the three model records despite differing dataset revisions. This is a check of recorded input identity, not a rerun.

## Identity and interpretation

- TypeSafe: jev-1.13.0; selected records dated2026-09-28.
- GPT: gpt-6-luna through api.openai.com/v1/decisions, dated2026-10-14 during public beta; immutable weights unspecified. Seventeen explicit English refusals count as incorrect/max-error; no operational failures in the complete entry.
- AutoTrust: autotrust/JEV-27B at51740a8891c2a8baefd969237fd44187b3e3a115, selected records2026-10-10, vLLM0.31 native single-pass readout, released adapter and decision bias. This is a different repository revision from the architecture walkthrough's14b425269ed24452e0a5ad5a8f3e51d139647a88; do not assume they are byte-identical. Model family and per-kind temperature match the depicted design.

Full-suite inputs were not independently compared case-by-case; the benchmark provides a shared scope with per-result dataset provenance. Training overlap is not ruled out. These measurements do not supply matched latency or dollar-cost comparisons, so those columns are omitted.

Other sources considered: Benchmark Heaven includes all three but uses differing sealed sets (A4/A5/S); AutoTrust's six-group report lacks GPT Decisions; the etsabary and akitaonrails comparisons lack AutoTrust. Their numbers were not spliced into this table.

## Frontier reasoning comparison

Added 23 October 2026: [Madrid-García & Merino-Barbancho, v4](https://arxiv.org/html/2609.34024v4), Tables 2 and S7. Separate from S1MB; no AutoTrust measurement in this study. The slide selects PubMedQA and DiagnosisArena-MCQ to show contrasting task difficulty. Figures are transcribed directly; per-1,000 costs are the paper's reported values, not recalculated from rounded totals.

Jev 1.13 and GPT-6 Sol received the same task information and options. Sol used none and medium reasoning effort. The run date was 26 September 2026; the cited revision was published 10 October. Accuracy uses top-1 choices. Latency is client-side: Jev through OpenRouter sequentially, Sol through OpenAI with four concurrent requests. This is not a controlled serving-speed comparison. Jev costs were response-reported; Sol costs were estimated from usage and execution-time list prices including reasoning. Do not infer a universal speedup, cost ratio or frontier ranking.

The none condition matters: much of Sol's diagnostic accuracy advantage remains without reasoning tokens. The comparison does not isolate architecture or training as the cause.

Also inspected stern9/jev-bench at 3bcf24f0de7f3830a7927604bd13242517aad159. It reports frontier accuracy, cost and latency, but uses default model settings and publishes no raw reasoning-token records; it was not used as evidence of an explicitly enabled reasoning configuration.
