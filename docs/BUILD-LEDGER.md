# Production build ledger

Baseline: 06f3efc, 21 tests passing. User explicitly adopted the linked ultimate build brief and requested implementation without another planning gate.

Task 1: Added SQLite project revisions, source records, raw worker moments and managed asset paths. Imports now retain stable on-disk files and queue additional URLs instead of deleting prior media. Recoverable legacy source copies are imported from checkpoint-referenced temporary files.

Verification: Store tests observed RED (module absent) then GREEN. Source recovery test uploaded bytes and read the same byte range from a second Node process. Parallel cold-start testing exposed SQLite busy timeout ordering; applying the timeout before WAL setup fixed the failure. Full suite: 24/24.

Implementation choice: keep native Node SQLite and raise the runtime floor to Node 22.13. Existing framework-free UI and integrations remain. This avoids a framework migration; older Node 20 installations must upgrade.
