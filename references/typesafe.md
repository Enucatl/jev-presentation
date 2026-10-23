# TypeSafe source record

Verified 2026-10-23 against official TypeSafe documentation. The talk deliberately pins **jev-1.13.0**, although the models page now also lists 1.14. Do not describe 1.13 as the newest release.

- [API contract](https://docs.typesafe.ai/api/system-one): POST `https://api.typesafe.ai/v1/systemone`, bearer authentication, `model`, `state`, and a named `questions` map. Each answer uses the corresponding question ID. Choice criteria are a map; Score criteria are an ordered array; Noul criteria are optional. The raw HTTP response includes `model`, `answers`, and `usage`.
- [Choice](https://docs.typesafe.ai/primitives/choice): returns the chosen option, a probability map, and confidence. Runtime option descriptions define the decision surface.
- [Score](https://docs.typesafe.ai/primitives/score): levels are zero-based positions. The returned score is their probability-weighted average; the legend maps positions to descriptions. Read the distribution when opposite ends may conceal disagreement behind the same average.
- [Noul](https://docs.typesafe.ai/primitives/noul): returns the probability of yes in `noul`, with no separate confidence value.
- [Confidence](https://docs.typesafe.ai/confidence): confidence is derived from the distribution, not an independent correctness estimate. Choice uses `(n × p_max − 1)/(n − 1)`. Score compares probability-weighted distance from the modal level with the mean absolute deviation of a uniform distribution, flooring at zero. A Noul confidence-like statistic `abs(2p−1)` can be computed by the caller but is not an API field.
- [Models](https://docs.typesafe.ai/models): published behavior says the state is ingested once and questions are evaluated in parallel. This describes observable/API behavior; it does not reveal the proprietary head, attention mask, or weights. Alias targets may move; retain both requested and returned model identifiers.
- [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer): TypeSafe calls its approach reinforcement learning for calibrated decisions (RLCD). The page describes the intended output contract and calibration goal; it does not publish a reproducible reward formula, training corpus, optimizer recipe, or complete architecture. AutoTrust's separately published distillation implementation is not evidence of TypeSafe internals.
- [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13): version-specific known weaknesses; use this alongside application-specific evaluation.

The Markdown versions of these pages were read directly where the web reader could not parse the page. Discovery index: [llms.txt](https://docs.typesafe.ai/llms.txt). Official machine-readable schema: [OpenAPI](https://api.typesafe.ai/openapi.json).

## Replay protocol

`fixtures/finance.json` is the only active replay fixture. It currently records a request and an explicit `awaiting_capture` status, with **no response**. Its fictional teaching record contains no real customer data.

Run `TYPESAFE_API_KEY=... node scripts/capture.mjs` with the key provided through the environment (prefer an existing exported environment variable to shell history). The script submits the pinned request once, validates the result, writes a timestamped immutable archive under `fixtures/captures/`, then atomically replaces the active fixture. It preserves the exact JSON request body and response body as strings, parsed copies, endpoint, model identifiers, and timestamp. Authentication headers are never stored. A failed request or failed validation leaves the active fixture unchanged.

Run `node scripts/validate-fixtures.mjs` to validate either the pending state or the capture. Captures must have matching IDs, category mappings, numeric probabilities in range, a normalized distribution within public-API rounding tolerance, valid score legends and expected values, the pinned returned model, and internally consistent raw/parsed records. Provenance metadata makes the capture inspectable; it is not a cryptographic attestation of a remote service.

Build the presentation again after capture so the committed response is bundled for offline replay. Commit the active fixture and archive only after reviewing the payload. The browser never receives the API key and never calls the hosted API. Synthetic test inputs live only in the unit test and cannot be rendered as recorded responses.

## Opening price comparison — checked 23 October 2026

The opening slide uses [TypeSafe's model reference](https://docs.typesafe.ai/models)
for Jev 1.13 (`jev-1.13.0`): USD 0.042 per million input tokens, output free.
Jev 1.14 has the same listed rate; examples in this deck remain pinned to 1.13.

[OpenAI's API pricing](https://developers.openai.com/api/docs/pricing) lists these
standard short-context rates (USD per million tokens, input / output):

- `gpt-6-luna`: 0.10 / 0.50.
- `gpt-6-sol`: 2.00 / 10.00.
- `gpt-6-astra`: 10.00 / 50.00.

The comparison uses uncached input, OpenAI's ≤272K input-token tier, and excludes
regional surcharges, caching, Batch/Flex, and accelerated processing rates.
These are token rates, not measured cost per correct decision. Input lengths,
tokenizers, output/reasoning usage, retries and review can change workflow cost.
The three opening primitive examples use fictional inputs and illustrative
probabilities, not recorded API responses. The Score illustration's expected
value is 0×0 + 1×0.1 + 2×0.8 + 3×0.1 = 2.0.

## RLCD overview slide (checked 2026-10-23)

Re-read TypeSafe's [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer) and [launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev). They name Reinforcement Learning for Calibrated Decisions and describe optimizing decisions with probabilities whose frequency interpretation matches outcomes. Neither inspected page gives a reproducible reward formula, training recipe, released corpus or item count. We therefore do not assert the suggested several-hundred-thousand-item estimate. Public distillation corpora used by AutoTrust are not evidence of TypeSafe's private corpus size.

The80%/16-of20 SVG is a conceptual explanation of calibration across comparable predictions, not a measured evaluation or description of TypeSafe's reward implementation. The slide avoids claiming standard LLM training ignores probabilities: next-token cross-entropy already optimizes a probability distribution, while TypeSafe's stated goal targets calibrated decision probabilities. The following AutoTrust slide concerns its independently published distillation recipe.

## Closing application examples (2026-10-23)

Two conceptual workflows adapt TypeSafe's [intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing), [per-field extraction verification cascade](https://docs.typesafe.ai/cookbooks/sde_cascade), and [candidate-selection extraction cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook). Routing and human escalation remain code-controlled. Live field checks describe the proposed interface, not a measured latency guarantee or financial approval policy. The support labels are illustrative; uncertainty and inadequate evidence both merit review, even when the model confidently detects a missing fact.

The ID artwork is a fictional, generic vector card with no real issuer, document number or security features. OCR spans and mappings are constructed: A=ELENA, B=ROSSI, C=14 MAY1988, D=02 NOV2031. Jev is given OCR text with labels/context and chooses candidate span IDs; code retrieves the chosen text and parses/validates dates. No OCR engine or API is run here. Candidate selection preserves source spans but cannot correct an OCR error or recover a missing candidate; “not found” provides an explicit escape hatch. This example does not claim ID-authenticity verification.
