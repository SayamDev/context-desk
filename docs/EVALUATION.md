# Speech, export and recovery evaluation

## Reproducible speech scoring

```sh
node scripts/evaluate-speech.js reference.txt hypothesis.txt
node scripts/evaluate-speech.js reference.txt hypothesis.txt --strip-diacritics
```

Inputs must be a permissioned human reference and the actual provider output. The script calculates Levenshtein WER/CER and reports normalization. Default: NFC, lowercase, punctuation/symbol removal, collapsed spaces. The optional mode removes **all Unicode combining marks**, including decomposed Arabic hamza, not only short vowels. Report both modes; do not use normalization to conceal a different word or claim semantic equivalence.

## Arabic smoke test, 31 October 2026

Source: [Google FLEURS](https://huggingface.co/datasets/google/fleurs), CC-BY-4.0; `ar_eg`, test row 0, id 1993, 8.16 seconds. This is an Arabic read-speech dataset sample, **not proof of Egyptian dialect performance**. Attribution: Google FLEURS dataset authors; see dataset card and associated paper. Audio/reference files remain outside Git. [Machine-readable result](evaluation/arabic-read-speech-smoke.json).

The sample was downloaded from the dataset viewer, muxed with a plain video frame, staged through the real app upload path and processed by a whole-recording Meta Muse Voice job with Arabic bias, no vocabulary hints and one speech request. The returned original cues were concatenated for comparison with the supplied reference.

| Metric | Default normalization | Combining marks removed |
| --- | --- | --- |
| Reference words | 15 | 15 |
| Hypothesis words | 16 | 16 |
| Word errors | 5 | 1 |
| WER | 33.33% | 6.67% |
| CER | 10.59% | 5.95% |

A repeated opening word remained. Additional strict differences included Arabic orthography/combining marks. The app now flags adjacent repeated words for review without deleting or rewriting them. Legitimate emphasis can also repeat a word: flags are review prompts, not error diagnoses. No general accuracy score follows from one utterance. Translation adequacy, word alignment, overlapping speech and dialect performance were not evaluated by this test.

## Required real-world corpus

Use permissioned clips with reference transcripts from Egyptian, Levantine, Gulf, Maghrebi and mixed Arabic/English speech; include names, slang, quiet speech, music and overlap. Record licence/consent, language varieties, source timestamps, reference author and adjudicating reviewer. Compare original wording, names, negation, questions, uncertainty and turn attribution. Evaluate translated meaning with bilingual reviewers; do not use an LLM judging its own output as proof. Log timing errors separately from WER.

A native reviewer must approve final public-demo subtitles. No fixed count of all world dialects, universal recognition support or emotion-confidence score is implemented.

## Other verification

- Real FFmpeg fixture: two-second requested trim rendered as 2.02s, 720×900, 12 fps, audio stream present. Joined Arabic glyphs visually inspected. About 230ms for that small local render plus frame capture; not a long-video benchmark.
- Browser: managed recording replay after server restart, saved hook/trim/caption edits after refresh; actual ascending/descending Library sorting.
- Queue: three recordings, ordering/cancellation, ambiguous request recovery and cached-ASR retry tests. Provider billing is not inferred from request counts.
- Sustained live capture, tracking, six-hour processing and producer-rated clip usefulness remain unverified. See STATUS.md.
