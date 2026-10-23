# AI That Decides — speaker notes

40 minutes of content, then 5 minutes of discussion. Source snapshot: 2026-10-23. All conceptual numeric examples are illustrative; only fixtures with captured status are API recordings.

## 1. AI That Decides

Slide: #/start · 45 seconds

I’m Matteo Abis. Today we will look at what changes when software can ask a model for a decision directly, instead of asking for text and interpreting the answer.

We will start with a transaction, build the basic idea from familiar LLM components, then look at calibration and an open implementation. We will finish with benchmarks and two practical workflows. The question to keep in mind is: where do we need intelligence, and where do we simply need the answer in a useful form?

- [TypeSafe · System One](https://docs.typesafe.ai/concepts/system-one)

## 2. Meet Jev

Slide: #/interface · 60 seconds

Jev is TypeSafe’s decision model, publicly released in early access on 15 September 2026. Send it shared evidence and typed questions. It returns probabilities directly.

The three interfaces are Choice, Score and Noul. We will see examples next. Notice the pricing shape: Jev charges for input tokens and has no output-token charge. The comparison here is a dated API price snapshot, not a cost-per-correct-decision benchmark. Actual workflow cost also depends on prompt length, repeated calls and how many cases need further work.

- [TypeSafe · model pricing](https://docs.typesafe.ai/models)
- [OpenAI · API pricing](https://developers.openai.com/api/docs/pricing)
- [TypeSafe · API](https://docs.typesafe.ai/api/system-one)
- [TypeSafe · launch, 15 Sep 2026](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

## 3. Three Ways to Ask

Slide: #/choice · 105 seconds

Choice asks which named category fits. Score asks where something belongs on an ordered scale. Noul asks whether a proposition is true and returns a probability of yes.

In the middle example, an incomplete payment trail means partially supported; missing evidence is not automatically contradiction. Score preserves the order of the levels, while Choice treats its labels as separate categories.

Do not look only at the expected score. A fifty-fifty split between 0 and 3 has the same mean as a fifty-fifty split between 1 and 2, but tells a very different story. Keep the distribution when uncertainty matters.

- [TypeSafe · Choice](https://docs.typesafe.ai/primitives/choice)
- [TypeSafe · Score](https://docs.typesafe.ai/primitives/score)
- [TypeSafe · Noul](https://docs.typesafe.ai/primitives/noul)

## 4. What Changes When the Answer Is a Decision?

Slide: #/decision-transition · 15 seconds

We have seen the interface. Now let’s understand why it changes the computation.

Start with the familiar approach: give a conventional LLM the evidence, then ask it to return JSON.


## 5. A Transaction Arrives. Classify It.

Slide: #/mismatch · 75 seconds

Mr Example receives a million-dollar payment from Test Corp. The supporting statement records one hundred thousand shares and a ten-dollar dividend per share. The amount and payment reference match.

On the right, watch the LLM produce the JSON one piece at a time. Use Replay if needed. Our software wants a category, but the model also emits braces, field names, quotation marks and a confidence word.

“High” is a generated label. It is not automatically a measured probability of being correct. To see where the time goes, let’s follow the computation inside the model.


## 6. Inside a language model

Slide: #/llm-architecture · 135 seconds

Follow the top row: text becomes token IDs, then vectors. Repeated decoder blocks update those vectors. The vocabulary projection assigns scores to possible next tokens. Softmax turns scores into probabilities; sampling selects a token.

Inside a block, attention mixes information between tokens. Queries describe what to look for, keys provide matching information, and values carry the content to combine. Causal attention sees the current and earlier positions. Feed forward transforms each token’s features through learned matrix operations and nonlinear functions. The red paths add each update back to the original vector.

Finally, the selected token goes back in. That loop generates the next token.

- [Llama 2 · decoder design](https://arxiv.org/abs/2307.09288)
- [The Illustrated GPT-2](https://jalammar.github.io/illustrated-gpt2/)
- [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)

## 7. Behind the JSON: prefill and decode

Slide: #/contract · 120 seconds

On the left, all prompt tokens are already known. The model processes their positions together, layer by layer. This creates large matrix-to-matrix operations that use accelerators efficiently. The final prompt position already supplies the scores for the first output token.

On the right, the next input depends on the previous output. For one sequence, decoding advances one token vector at a time. The KV cache keeps earlier attention information, so it need not all be recomputed, but each new token still passes through the model.

The throughput figures illustrate the contrast, not a universal ratio. Ask: which computation could disappear if we only wanted a category?

- [NVIDIA · prefill & decode](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/)
- [Hugging Face · KV caching](https://huggingface.co/docs/transformers/main/cache_explanation)
- [AutoTrust · backbone config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/config.json)

## 8. Do we need to spell it out?

Slide: #/read-decision · 30 seconds

Pause here. The model has already processed all the evidence and produced a next-token distribution. For a simple bounded decision, that may be enough.

This does not mean every problem is solved during prefill: additional reasoning can improve difficult answers. Our narrower question is whether we need an entire generated sentence or JSON object when we only want one choice.


## 9. Vocab Score: One Number per Token

Slide: #/vocabulary · 75 seconds

The vocabulary is the inventory of token IDs the model can use. Tokens can represent whole words, parts of words, punctuation or special symbols. The Qwen configuration used here has 248,320 entries.

After the full decoder stack, the final token’s hidden vector is projected into one number for every vocabulary entry. These numbers are logits: raw scores, not probabilities. Higher means more preferred at this position.

The scores shown here are just examples. The useful observation is that the model already scores possible answers before it samples anything.

- [AutoTrust · backbone config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/config.json)

## 10. Let’s Build Jev at Home

Slide: #/home-prompt · 60 seconds

Keep the transaction and statement, but change the requested answer. Map Business to A, Inheritance to B, Employment to C and Gift to D. Ask for only the letter, then stop at the answer position.

Choose labels that are each one token in that exact context. Whitespace and tokenization matter. The meaning of A comes from the prompt; it is not permanently tied to Business.

We now have four relevant vocabulary entries. Instead of sampling one and continuing generation, we can read those entries directly.

- [SemIf · readout](https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/23cf1f39fc9534fe81437200959b6dfc7106e45a/README.md)

## 11. Read the Probabilities

Slide: #/readout · 90 seconds

Point to A, B, C and D in red. Their probabilities under the full vocabulary add up to 0.40. Divide each by that total to get a distribution over our four choices.

For A, 0.34 divided by 0.40 gives 0.85. The other three become 0.05 each. Every result lies between zero and one, and the four sum to one. Applying softmax directly to only those four logits gives the same result.

We have removed sampling and the answer-generation loop. But normalization alone does not make these numbers reliable probabilities of correctness. We will address that shortly.

- [SemIf · readout](https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/23cf1f39fc9534fe81437200959b6dfc7106e45a/README.md)

## 12. Jev 101: Summary

Slide: #/recap · 60 seconds

Four ideas so far. The scoring machinery already exists in an LLM. Reading a decision directly removes the generated-answer loop. The pretrained model brings broad language and world knowledge. And the prompt can define new questions and categories without a separate training run for each task.

This is the basic idea, not a reconstruction of TypeSafe’s private implementation. It explains why the approach is attractive. The next questions are how far that knowledge transfers, how several questions can share work, and how to make the probabilities useful.

- [SemIf · readout](https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/23cf1f39fc9534fe81437200959b6dfc7106e45a/README.md)
- [Brown et al. · learning from prompts](https://arxiv.org/abs/2005.14165)

## 13. “Just a Classifier”?

Slide: #/just-a-classifier · 75 seconds

Classification itself is old. The interesting change is what the model already knows before we describe the task.

On the left, the familiar workflow collects labeled examples and trains a task-specific model. On the right, a pretrained language model can use a task described in words, drawing on knowledge learned across many domains. That makes new questions much easier to try.

Earlier classifiers could also use transfer learning. The point is the breadth and flexibility of this interface, not that transfer is new. Nor does it guarantee performance in an unseen domain. That still needs evaluation.

- [Sebastian Raschka · Jev & generalization](https://sebastianraschka.com/blog/2026/jev-classification-generalization.html)
- [Brown et al. · learning from prompts](https://arxiv.org/abs/2005.14165)

## 14. Reuse the Work. Isolate the Questions.

Slide: #/question-branches · 105 seconds

Use the same transaction for three questions: source of funds, strength of evidence, and whether the client is the seller.

The long state comes first. In a causal model, later questions cannot change the earlier state representations. We can compute the state once and reuse its cached keys and values. Each question branch can attend to that state and its own tokens, while an attention mask hides the other branches.

This gives shared work without one answer influencing another. The diagram explains an implementable branching design; it does not reveal TypeSafe’s unpublished internals. The questions must be answerable from the shared evidence independently.

- [Hugging Face · KV caching](https://huggingface.co/docs/transformers/main/cache_explanation)
- [SemIf · readout](https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/23cf1f39fc9534fe81437200959b6dfc7106e45a/README.md)

## 15. Another Question Is Only Another Branch.

Slide: #/speculative-questions · 90 seconds

Walk through the token arithmetic. Three separate requests repeat the ten-thousand-token state three times. One request with three questions reads it once. That is 30,300 versus 10,300 input tokens in this simplified example.

This is why TypeSafe recommends asking even some speculative questions. We can ask whether the client is the seller at the same time as asking the source of funds. If the transaction is employment income, code discards the irrelevant seller answer.

We save a second round trip when that answer is needed. This works when the question can be answered from the documents, without waiting for another answer.

- [TypeSafe · parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions)
- [TypeSafe · speculative fan-out](https://docs.typesafe.ai/patterns/fan-out)

## 16. Adds Up to 1. Does It Deserve 97%?

Slide: #/raw-probabilities · 60 seconds

Our homemade decision model returns 97% for Business. The numbers sum to one, but does 97% mean what we want it to mean?

Ask the room: would you act on an 80% prediction? The answer depends on the consequence of an error and whether similar predictions really succeed about eight times in ten.

Language models can prefer particular labels, answer positions or familiar phrasing. Their next-token probabilities can also be too concentrated. Calibration compares predicted probabilities with observed outcomes. Accuracy asks whether the winner is right; calibration asks whether the assigned uncertainty is meaningful.

- [Zhao et al. · Calibrate Before Use, 2021](https://arxiv.org/abs/2102.09690)
- [Guo et al. · ICML 2017](https://arxiv.org/abs/1706.04599)

## 17. Two Knobs: Bias and Temperature

Slide: #/bias-temperature · 105 seconds

There are two simple adjustments. Bias adds a separate offset to each score. It can correct a persistent preference for a label and can change which option wins. Adding the same offset everywhere changes nothing after softmax.

Temperature divides all adjusted scores by a positive number. A temperature above one spreads probability more evenly; below one makes it sharper. Point to the grey and red curves. The winner stays the same, but the probabilities change.

Fit these values on held-out examples with known outcomes. Smoothing is not automatically improvement: it helps only when the original distribution is too confident in the relevant setting.

- [Guo et al. · ICML 2017](https://arxiv.org/abs/1706.04599)
- [Zhao et al. · Calibrate Before Use, 2021](https://arxiv.org/abs/2102.09690)

## 18. Open Implementations

Slide: #/calibration-in-code · 90 seconds

Here are two concrete implementations. SemIf keeps the model frozen and fits temperature. In its small WANLI experiment, the out-of-fold calibration error falls while accuracy stays unchanged. That is exactly what temperature alone should be able to do: adjust certainty without changing the ranking.

AutoTrust has a learned decision-head bias and a fitted temperature for each question type. Notice how close its temperatures are to one. Most of the adaptation has already happened during training of its adapters and decision head.

These are separate projects with different training and evaluation setups. Let’s open up AutoTrust’s architecture next.

- [SemIf · calibration experiment](https://github.com/TheoLeeCJ/SemIf-OpenJev/blob/23cf1f39fc9534fe81437200959b6dfc7106e45a/docs/CALIBRATION.md)
- [AutoTrust · pinned implementation](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/serve_decide.py)
- [AutoTrust · fitted temperatures](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/calibration.json)

## 19. Inside AutoTrust JEV-27B

Slide: #/autotrust-architecture · 105 seconds

Follow the decision path from left to right. The evidence, question and options enter a frozen Qwen3.8 27B backbone. Small LoRA updates are inserted inside attention and feed-forward projections.

The final hidden vector feeds a trained decision projection with a learned bias. It produces 24 slots: two for Noul, six for Score and sixteen for Choice. For our four-option example, we keep four Choice slots, apply the fitted temperature and normalize.

AutoTrust is an independent open model, not TypeSafe Jev. It also retains a generation path. Here we are following its specialized decision path, whose published implementation we can inspect.

- [AutoTrust · pinned model card](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/README.md)
- [AutoTrust · adapter config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/adapter/adapter_config.json)
- [AutoTrust · slot config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/judge_config.json)
- [AutoTrust · fitted temperatures](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/calibration.json)

## 20. LoRA: Low Rank Adapters

Slide: #/decision-lora · 90 seconds

The grey squares represent the original weight matrices. They stay frozen. The red square represents small learned updates spread through the model, not a single layer attached at the end.

LoRA represents each update using two smaller matrices. Their low rank limits the number of trainable parameters. AutoTrust uses rank 16 and about 108 million LoRA parameters, around 0.4% of the backbone size.

These updates change how the model processes the evidence while retaining its pretrained weights. This is more powerful than adjusting the final probabilities alone: we are adapting the internal representation that will drive the decision.

- [Hu et al. · LoRA, 2021](https://arxiv.org/abs/2106.09685)
- [AutoTrust · adapter config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/adapter/adapter_config.json)
- [AutoTrust · pinned model card](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/README.md)

## 21. Give the Model a Decision Ending

Slide: #/decision-head · 90 seconds

The final token position has 5,120 features. Instead of projecting those features onto the entire vocabulary, AutoTrust trains a small projection onto 24 decision slots, plus a bias.

The slots are organized by question type. A four-way Choice uses four of the sixteen available Choice slots. The prompt explains what A, B, C and D mean for this request. Tomorrow, those same slots can represent different categories.

This separates a stable output shape from runtime-defined meanings. The head is small, but it must be trained to interpret the final representation correctly. Temperature then adjusts the active slot distribution.

- [AutoTrust · slot config](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/judge_config.json)
- [AutoTrust · pinned model card](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/README.md)
- [AutoTrust · pinned implementation](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/serve_decide.py)

## 22. Reinforcement Learning for Calibrated Decisions

Slide: #/rlcd-training · 90 seconds

TypeSafe calls its approach reinforcement learning for calibrated decisions. The stated goal is to learn useful decisions together with probabilities that reflect their uncertainty.

The picture illustrates the target: across many comparable predictions assigned 80%, about sixteen out of twenty should occur. It is a property of a collection of predictions, not a guarantee for an individual case.

TypeSafe has not published the reward formula, detailed training recipe or corpus size. We should not fill in those gaps. Standard language-model training already learns probabilities; the distinction here is a training objective directed at calibrated decisions. AutoTrust offers a different, published recipe.

- [TypeSafe · AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer)
- [TypeSafe · launch, 15 Sep 2026](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

## 23. Train the Distribution, Not Just the Winner

Slide: #/decision-training · 90 seconds

Both distributions choose Business, but they disagree about uncertainty. The teacher assigns 70%; the student assigns 90%. Training only the winning category would miss that difference.

AutoTrust trains its LoRA updates, slot weights and bias to match the full teacher distribution. It uses a distribution-matching loss, with an additional ordered-score loss for Score questions. After training, it fits temperatures on held-out rows.

Finally, evaluate against independent outcome labels. Matching a teacher is not proof of correctness or calibration: the student can inherit the teacher’s mistakes. This is distillation from Jev probabilities, not TypeSafe’s private RLCD recipe.

- [AutoTrust · pinned model card](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/README.md)
- [AutoTrust · fitted temperatures](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/calibration.json)
- [TypeSafe · launch, 15 Sep 2026](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

## 24. Keep the Knowledge. Learn the Odds.

Slide: #/calibration-recap · 45 seconds

Pause and simplify. The large sphere is the pretrained Qwen model. We keep that foundation and train relatively small components around it: internal LoRA updates, a decision head with bias, and temperature adjustments.

The result is a model adapted to decisions and teacher distributions. We have moved from reading arbitrary label-token scores to a purpose-trained readout. Now we need to see how it performs.

- [AutoTrust · pinned model card](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/README.md)
- [AutoTrust · fitted temperatures](https://huggingface.co/autotrust/JEV-27B/blob/14b425269ed24452e0a5ad5a8f3e51d139647a88/calibration.json)

## 25. Three Models. The Same Benchmark Suite.

Slide: #/shared-benchmarks · 75 seconds

This table compares three decision interfaces on the S1MB English suite. It covers 137 benchmarks and 26,269 judgments per model. Read the rows in order: TypeSafe, GPT-6 Luna Decisions, then AutoTrust.

These are baseline-adjusted scores, not accuracy percentages. The task average gives equal weight to Noul, Choice and Score. AutoTrust leads this aggregate snapshot; that does not mean it wins every task.

The table measures task performance, not overall calibration, latency or cost. GPT-6 Luna here is the native Decisions API, not a chat model generating JSON or a frontier reasoning run.

- [S1MB · pinned results](https://huggingface.co/datasets/hotchpotch/s1mb-result/tree/4259f921ae6f6e4b2943b6179eca2380ba1a5922)
- [S1MB · scoring](https://github.com/hotchpotch/S1MB/blob/9ad06feacc372af4a99beea0bf25a0bcaa1df5c4/evaluator/SCORING.md)

## 26. A Closer Look at Shared Choice Tasks

Slide: #/shared-choice-benchmarks · 75 seconds

These four examples make the aggregate easier to interpret. The first three involve intent classification; GSM8K is adapted into a four-choice math task. Here the figures are ordinary accuracy on the listed subsets.

The recorded inputs match across the three models. Notice that the ordering changes by task: AutoTrust leads MASSIVE, while TypeSafe leads the other three shown. Small differences on small subsets should not drive a universal ranking.

The engineering lesson is to compare on your own decision types, then look at the errors. An overall benchmark average cannot tell you which model is best for a particular workflow.

- [S1MB · pinned results](https://huggingface.co/datasets/hotchpotch/s1mb-result/tree/4259f921ae6f6e4b2943b6179eca2380ba1a5922)

## 27. What Does Reasoning Buy?

Slide: #/reasoning-benchmark · 105 seconds

This is a separate study using the same questions for Jev and GPT-6 Sol. None and medium refer to Sol’s reasoning effort. The columns show accuracy, median and tail latency, and cost per thousand items.

On PubMedQA, Jev and medium-reasoning Sol have similar accuracy. On difficult diagnostic cases, Sol has a large advantage even without reasoning. So the difference cannot be explained by reasoning tokens alone.

The recorded costs and timings are useful context, but serving conditions differ: Jev used OpenRouter sequentially; Sol used the OpenAI API with four concurrent requests. Do not treat the timing ratio as a controlled model-speed comparison.

- [Madrid-García & Merino-Barbancho · Tables 2 & S7](https://arxiv.org/html/2609.34024v4)

## 28. Jev Decides. Code Routes. Specialists Work.

Slide: #/route-and-review · 90 seconds

Return to our transaction. Jev decides the source category. Code uses that result to route the material to a specialist. That specialist can use domain tools and a reasoning model where deeper analysis is valuable.

As structured findings arrive, Jev can check each field against the original evidence. The amount and payer may be supported, while the shareholding history remains uncertain. Code applies the review policy and surfaces the uncertain field to an expert.

The model supplies judgments; code controls the workflow. Validate thresholds and end-to-end latency on the actual workload before deciding how much review to automate.

- [TypeSafe · intent routing](https://docs.typesafe.ai/patterns/intent-routing)
- [TypeSafe · extraction cascade](https://docs.typesafe.ai/cookbooks/sde_cascade)

## 29. Extract by Choosing

Slide: #/extract-by-choosing · 90 seconds

Start with OCR: it turns the ID image into text spans and preserves nearby labels. Jev receives those candidate spans and chooses which one belongs to each requested field.

For given name, choose A; for surname, B; for date of birth, C. Code then copies the selected text rather than asking the model to generate it again. Code also parses and validates dates.

Include a not-found option when no candidate fits. Choosing a span prevents inventing a value outside the candidates, but it cannot repair a bad OCR result automatically. The candidate quality and the matching quality are separate checks.

- [TypeSafe · extract by choosing](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook)

## 30. Give Intelligence the Right Interface

Slide: #/closing · 60 seconds

The takeaway is to give intelligence the right interface. Keep the model’s knowledge, ask for the decision you need, and use code to execute clear rules. Bring in deeper reasoning when the case calls for it.

Leave the audience with the question on screen: where does your system generate text just to make a choice?

Pause and invite discussion for the remaining five minutes. Useful prompts: which decision could you test first, what would an error cost, and what evidence would persuade you to automate it? The source appendix is linked here.


## 31. Sources & Further Reading

Slide: #/source-appendix · Appendix

Use this appendix during questions or after the talk. The links cover TypeSafe’s interface, the architecture explanations, calibration research, pinned open implementations, benchmarks and practical workflows.

Return to the closing slide for discussion. The source snapshot is dated so version-sensitive claims can be checked later.
