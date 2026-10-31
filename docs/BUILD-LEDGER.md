# Production build ledger

Baseline: 06f3efc, 21 tests passing. User explicitly adopted the linked ultimate build brief and requested implementation without another planning gate.

Task 1: Added SQLite project revisions, source records, raw worker moments and managed asset paths. Imports now retain stable on-disk files and queue additional URLs instead of deleting prior media. Recoverable legacy source copies are imported from checkpoint-referenced temporary files.

Verification: Store tests observed RED (module absent) then GREEN. Source recovery test uploaded bytes and read the same byte range from a second Node process. Parallel cold-start testing exposed SQLite busy timeout ordering; applying the timeout before WAL setup fixed the failure. Full suite: 24/24.

Implementation choice: keep native Node SQLite and raise the runtime floor to Node 22.13. Existing framework-free UI and integrations remain. This avoids a framework migration; older Node 20 installations must upgrade.

Task 2: Added a persistent Library with search, real ascending/descending title/date/duration/size/clip sorting and reversible Trash. Captured assets and frame previews use stable content hashes. Editor autosave reports success only after SQLite confirms a revision; tab collisions preserve a separate recovery copy rather than silently overwriting newer work. All local videos are staged before automatic analysis.

Verification: 27/27 tests. Browser tested three real generated recordings, ascending/descending title order, reopened captions and -0.2s offset, 1–5s trim, then stopped/restarted the isolated server and replayed the managed recording (readyState 4, advancing video time). A hook edited immediately before refresh also survived. No model re-analysis occurred on recovery. The fixture was synthetic test video with generated speech; this proves recovery, not dialect accuracy or editorial quality. Screenshot: /private/tmp/context-desk-library-recovery.png.

Task 3: Discovery now executes on the local Node server, with SQLite-backed picture samples, speech/analysis/translation caches, model-result moments and queue checkpoints. Subtitles retain full options and completed tracks across restart. Jobs expose actual section/check/request counts, pause, explicit retry, cancellation and waiting order. Multiple file selection stages recordings sequentially and queues each discovery. Each worker runs one job at a time; discovery and subtitles can each have one active job.

Verification: 31/31 tests, including three queued recordings, cancellation/order, SQLite reopen after subtitle translation failure with no repeated ASR, and unknown in-flight calls restored as interrupted without execution. A real Meta Muse Voice + Muse Spark request processed the 14-second speech fixture through the new backend, completed after browser refresh and published a persisted moment. Muse Spark correctly rejected the synthetic test pattern; no editorial-quality or dialect-accuracy claim follows.

Task 4: Source and output language choices now appear before import. Added official 25-language bias filtering, a second code-switch language, free-form dialect hints, glossary and faithful/natural/concise translation modes. Subtitle rows can display original text beside translation and carry manual uncertainty flags that block reviewed exports. Moment Map opens actual source windows and labels sampled coverage without performance scores. Story Memory stores editor/AI provenance, confirmations, source citations and optional cross-episode context; only confirmed notes enter discovery. Export, reversible memory Trash and revision conflict handling are provided.

Verification: 34/34 tests, including official-name-only language bias, exclusion of unconfirmed memory and glossary/mode cache invalidation. Browser created and saved a named memory with an editor-confirmed note; source/output language controls were verified before the import action. Meta speech documentation rechecked 31 Oct: 25 language names, code switching and keyword hints; no native word timestamps/confidence/emotion labels. Reference: https://dev.meta.ai/docs/speech-to-text.
