# Local Arabic/English ASR fixture evidence

This is an offline Node CPU smoke test, not browser WASM, microphone, dialect, latency, or production acceptance. @huggingface/transformers4.3.2 used its real ONNX forward and generation paths, not mocked transcripts. All transcript accuracy/confidence remains unknown and requires review. No paid provider or microphone was used.

## Verified detector path

- Transformers.js4.3.2 `packages/transformers/src/models/whisper/modeling_whisper.js` lines58–62 defaults a missing language to English (the automatic-detection TODO is present). The implementation must not treat language:null as auto.
- `PreTrainedModel._call` forwards to `forward`, and `seq2seq_forward` runs the encoder and decoder with supplied `decoder_input_ids`; actual output here was logits[1,1,51865].
- The local helper masks comparison to every configured language token, selects the global winner, computes language-token softmax, and rejects a winner other than Arabic or English. This follows OpenAI Whisper v20250625 decoding.py54–68. Token probability is not transcript confidence.

Pinned source references:

- https://github.com/huggingface/transformers.js/blob/4.3.2/packages/transformers/src/models/whisper/modeling_whisper.js#L58
- https://github.com/huggingface/transformers.js/blob/4.3.2/packages/transformers/src/models/modeling_utils.js#L1130
- https://github.com/openai/whisper/blob/v20250625/whisper/decoding.py#L54

## Fixtures and attribution

Conneau, Alexis; Ma, Min; Khanuja, Simran; Zhang, Yu; Axelrod, Vera; Dalmia, Siddharth; Riesa, Jason; Rivera, Clara; Bapna, Ankur (2022). FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech. arXiv:2205.12446. https://arxiv.org/abs/2205.12446

CC-BY-4.0: https://creativecommons.org/licenses/by/4.0/. Dataset pin70bb2e84b976b7e960aa89f1c648e09c59f894dd. fixtures.json contains exact IDs, expected text, source/rendered hashes and modification notices. Original public read-speech clips were converted from float WAV to16kHz mono PCM16; mixed fixtures concatenate the two clips with0.3s silence. These are artificial mixed clips, not proof of natural code-switch performance.

- `fleurs-ar_eg-test-86.wav`: 4.68s, 149838B, SHA256 `9ef849070e257ce6f7dd88e60c468eb64dd5f05c83f349d9125d0d2fd54dc2af`.
- `fleurs-en_us-validation-28.wav`: 3.84s, 122958B, SHA256 `dfa565303f145e7ba8dc4f5398829cac959afe3fb4855ac73206dc3054019534`.
- `fleurs-mixed-ar-then-en.wav`: 8.82s, 282284B, SHA256 `796ed9bd4d0d095ac420cdc1a617f74ca7295f642b994c2ed4b2c83d97d5ea1c`.
- `fleurs-mixed-en-then-ar.wav`: 8.82s, 282284B, SHA256 `c48207ee2976b25a467c39fda24d37a969bcb975e4ac9ec27cae5c707b571ec7`.

## Same-fixture comparison

Both use device:cpu, dtype:q8,2intra-op threads, greedy generation with max_new_tokens:128. Direct first-token language detection precedes an explicit transcribe language. Features/audio stayed local; allowRemoteModels=false during inference. Model files were fetched separately from fixed pinned public HF URLs, with ONNX SHA256 matching published LFS metadata.

### Tiny

`Xenova/whisper-tiny@5332fcc35e32a33b86612b9a57a89be7906102b1`, Apache-2.0 per pinned model card; 43678147B total downloaded artifacts. Exact artifact hashes are in the retained local model manifest.

- `fleurs-ar_eg-test-86.wav`: selected ar (0.9796 language-token probability), 5.42s inference.
  Expected: في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة.
  Actual:  في مناخ الشركة الأوصد الدفة الأميق واللمنز الأحمية كبيرة
- `fleurs-en_us-validation-28.wav`: selected en (0.8976 language-token probability), 2.13s inference.
  Expected: It's worth half an hour to stroll about the intriguing village.
  Actual:  It's worth half an hour to struggle about the intriguing village.
- `fleurs-mixed-ar-then-en.wav`: selected ar (0.9776 language-token probability), 3.15s inference.
  Expected: في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة. It's worth half an hour to stroll about the intriguing village.
  Actual:  في مناخ الشركة الأوصدد في الأميقل المنزل أهامية كبيرة
- `fleurs-mixed-en-then-ar.wav`: selected ar (0.9634 language-token probability), 3.02s inference.
  Expected: It's worth half an hour to stroll about the intriguing village. في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة.
  Actual:  في مناخ الشركة الأوصد الدفع الأميقر للمنزل أهاميكا بيرة

### Base

`Xenova/whisper-base@64da57285918e20ea79ea5c88eed7197933abaa8`, Apache-2.0 per pinned model card; 79733921B total downloaded artifacts. Exact artifact hashes are in the retained local base-model manifest.

- `fleurs-ar_eg-test-86.wav`: selected ar (0.9971 language-token probability), 10.14s inference.
  Expected: في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة.
  Actual:  في موناخ الشرق الأوسط الدفع لم يكن للمنزل أهمية كبيرة
- `fleurs-en_us-validation-28.wav`: selected en (0.8643 language-token probability), 4.93s inference.
  Expected: It's worth half an hour to stroll about the intriguing village.
  Actual:  It's worth half an hour to stroll about the intriguing village.
- `fleurs-mixed-ar-then-en.wav`: selected ar (0.9881 language-token probability), 3.81s inference.
  Expected: في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة. It's worth half an hour to stroll about the intriguing village.
  Actual:  في موناخ الشرق الأوسط الدفع الأمياء للمنزل أهمية كبيرة
- `fleurs-mixed-en-then-ar.wav`: selected ar (0.9300 language-token probability), 6.93s inference.
  Expected: It's worth half an hour to stroll about the intriguing village. في مناخ الشرق الأوسط الدافئ، لم يكن للمنزل أهميّة كبيرة.
  Actual:  لقد نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن نحن
  Probe error: `recognition-transcript-truncated`.

## Interpretation

The direct decoder API and real automatic Arabic/English selection work on the two monolingual samples. Base substantially improves Arabic over tiny and transcribes the English sample exactly, while still making Arabic word errors. Both models omit the English sentence in the Arabic-first artificial mixed clip. Tiny also omits English in the English-first clip; base repeats Arabic text until the128-token probe limit. The production worker uses440tokens, so this probe does not establish that its final truncation behavior is identical. It establishes a serious mixed-clip failure requiring further work.

Neither model qualifies within-chunk code-switch transcription from these results. A language-token score must never be presented as confidence in recognized words or used to authorize a business action.

Reproduction: run `node probe-inference.mjs` or `node probe-inference-base.mjs` from this directory after downloading the separately pinned model files. JSON results and scripts are retained here; nothing is added to the application routes or production activation by this artifact.


## Browser capture and graceful finish proof

See browser-graph-finish-results.json for actual WebAudio → capture Worklet → pinned browser WASM execution. The English fixture used a documented100× gain because its original RMS was below the VAD threshold; Arabic used raw recorded PCM. Hardware getUserMedia calls and external page requests were zero. Final drafts arrived after graceful Stop, once each, and then the session ended. This is not the founder's microphone or natural conversation/code-switch acceptance. Model data were mirrored locally for this isolated test; preparation timing is not a public download measurement.
