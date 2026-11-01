# Local OBS / encoder recording backend

Implemented 1 November 2026 in `lib/live-ingest.js`. This is an advanced alternative to browser-tab capture: OBS or another encoder **on this computer** sends video/audio to a temporary localhost RTMP receiver. It is not a downloader for arbitrary YouTube/Twitch/Kick links, an internet RTMP service, a broadcast publisher, or a multistreaming server. The parent integration supplies routes and UI; this module does not change them.

## What it records

FFmpeg listens on an allocated `127.0.0.1` port and accepts one encoder connection. It transcodes video to H.264, up to 1920×1080 at 30 fps, with AAC stereo audio when the sender supplies an audio track. Source aspect ratio is preserved. The output segmenter targets 24-second windows, with forced keyframes at the boundaries. A graceful stop/sender finish can produce a final shorter window.

The module reads only completed entries from FFmpeg's local CSV segment manifest. It probes each finalized MP4, checks its duration against the manifest, saves it as a managed content-addressed asset, saves a source-linked moment, and checkpoints a `live_window` record **before** optional speech/story processing. Raw windows have `status: 'captured'` and `manual: false`; continuous capture must not inflate the useful-clip count before analysis/editor selection. An image preview is attempted locally; preview failure does not discard the video. No model requests or paid API calls are made here.

Completed media and moments survive sender disconnection, receiver cancellation, application restart and optional callback failure. The open, unfinalized window can be lost after a forced kill or crash; no zero-loss claim is made. A missing audio track is recorded as such, rather than described as audible capture.

## Factory and integration contract

```js
import {createLiveIngestService} from './lib/live-ingest.js';

const live = createLiveIngestService({
  store,
  getActiveProjectId: () => activeProjectId, // optional synchronous UI/server owner
  onWindow: async ({sessionId, projectId, window, moment, asset}) => {
    // Media, moment and window are already durable. Always target projectId,
    // even if another project is selected while this asynchronous task runs.
    // Any later AI call belongs to the parent's explicit analysis workflow.
  }
});

const session = await live.start({
  projectId: liveProject.id,
  title: 'My encoder recording',
  maxSeconds: 21600, // optional, maximum six hours of captured media
  maxBytes: 20 * 1024 ** 3 // optional, maximum 20 GiB per session
});

// Display these only in the explicitly opened local encoder setup UI.
const {serverUrl, streamKey, streamUrl} = session.connection;

live.list();                        // snapshots omit connection credentials
live.get(session.id);               // snapshot, saved windows and health
live.connection(session.id);        // explicit current local setup credentials
await live.stop(session.id);        // finalize before returning
await live.command(session.id, 'cancel', {projectId: liveProject.id});
const resumed = await live.command(session.id, 'resume', {
  projectId: liveProject.id
});                                 // fresh connection; reconnect OBS
await live.shutdown();              // stop all receivers before closing store
await live.waitForCallbacks();      // optional; caller owns callback timeout
```

Use a dedicated existing live project (`sourceId` must be empty), rather than mixing capture into an imported recording. Trashed/missing projects are rejected. At most one receiver starts/runs at a time in the service. If `getActiveProjectId` returns an ID, starting/resuming requires that owning project to be active. Changing the selected project does not redirect saved windows or callbacks. Stop/cancel can still target the original session; an explicit mismatching `projectId` is refused.

`start()` and `command(..., 'resume')` return the snapshot plus `connection`. `list()` and `get()` never contain stream URLs or keys. `connection()` returns an active receiver's setup details, or asks for explicit resume when inactive. Route handlers must keep this information local and apply the app's existing origin/ownership checks; do not place credentials in routine logs or public job lists.

Session snapshots expose `status`, `phase`, `error`, `elapsedSeconds`, `bytes`, `windowCount`, `windows`, `localOnly` and `requiresResume`. Window records contain asset descriptors, source start/end/duration, original `projectId`, audio presence and optional processing status. Durable record kinds are `live_ingest` and `live_window`.

## OBS setup

1. Create/open a live project and explicitly start this receiver.
2. In OBS's custom streaming service settings, use the returned `serverUrl` as Server and `streamKey` as Stream Key. Both refer to this computer. Use a compatible H.264/AAC stream and include the intended audio sources.
3. Start the encoder. The receiver reports waiting until media is arriving and its first window is finalized; a spawned FFmpeg process alone is not proof that recording has succeeded.
4. Check the first saved clip's picture and audio. Continue working while additional windows are saved.
5. Stop the encoder or use the app's stop action. Wait for finalization before closing the local server.
6. After a disconnection/restart, explicitly resume and update OBS with the new connection. Previous windows remain available.

This backend and its synthetic sender were exercised; the actual OBS application and its setup UI were not operated by this task. Parent integration must still verify the human setup flow, audio selection and real sustained OBS recording.

## Clock and recovery rules

Each MP4 has timestamps reset locally, so its moment's `mediaStart` is `0`. Its `start`/`end` are monotonic **captured-media** times in the session. A resumed receiver appends at the latest saved end. Disconnected wall time is not silently presented as recorded footage; each run has its own persisted wall-clock start and captured-time offset. These are not platform VOD timestamps.

On restart, active sessions become `interrupted`. No listener, encoder, callback or AI request starts automatically. Explicit resume recovers any finalized manifest entries that had not yet been staged, preserves deterministic moment/window IDs, discards unfinalized temporary leftovers and starts a new receiver/address. Previously staged entries are reused rather than counted/saved twice. Managed assets remain after temporary segment cleanup.

Optional `onWindow` runs independently after durable staging, so a slow/failing analyzer does not block capture of subsequent media. A callback is checkpointed as running before invocation, then complete/error. Errors preserve media and are reported on the window. Unknown/running callbacks are not replayed automatically after restart or resume: the parent must offer an explicit retry using the saved asset. This prevents silently repeating potentially billable downstream analysis.

## Bounds and security boundaries

- Fixed generated `rtmp://127.0.0.1:PORT/live/KEY` input. No supplied source URL, host, port or external stream key is accepted, and no arbitrary URL is fetched.
- **The generated key is a session identifier, not an authentication guarantee.** FFmpeg's native RTMP listener warns on unexpected stream/app names instead of providing a complete authenticated server. Other local processes may reach the socket. Never bind this receiver to `0.0.0.0`, expose it on LAN, forward its port or describe it as a secure remote ingest service. A real authenticated gateway would be separate work. See [FFmpeg's RTMP implementation](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavformat/rtmpproto.c).
- Keys live only in the active runtime connection, not persisted session records or routine snapshots. FFmpeg stderr is drained and discarded because it may contain a URL/key. Operating-system process inspection by local users can still reveal FFmpeg's command-line arguments.
- Six-hour captured-media maximum; 20 GiB session budget; 64 MiB individual segment bound; maximum 100 saved sessions and 64 receive runs per session. Local free space is checked before spawning and while receiving. The preflight reserves a safety margin plus room for one bounded window; it does not preallocate the full possible six-hour recording.
- A 500 ms default poll checks local manifests, pending segment sizes and free space. A rapidly growing current file can briefly exceed a budget between checks; limits are protective bounds, not filesystem quotas. On failure, stop reception and retain earlier managed windows.
- Manifest entries must use generated basenames and monotonic numeric source clocks. Symlinks, oversized/incomplete media, unreadable video and mismatching durations are refused. Raw unfinalized files are never treated as successful windows.
- A built-in Node supervisor watches a liveness pipe from the application and stops FFmpeg when that pipe closes, including after application termination. This avoids the usual macOS behavior where a raw child process can continue after its Node parent dies. No daemon or package is installed.
- Stop sends SIGTERM, waits for the final manifest pass and escalates to SIGKILL after a grace period. The supervisor also bounds its own graceful shutdown. Already finalized work survives; a forced kill can prevent the last MP4 from finalizing.
- Port allocation checks an available loopback port before FFmpeg opens it. Another local process can race for that port; startup failure requires explicit retry and is not hidden by an automatic loop.

FFmpeg's segmenter documents keyframe-dependent boundaries and CSV filename/start/end records. These are the relevant implementation sources: [official segment documentation](https://ffmpeg.org/ffmpeg-formats.html#segment), [official muxer source documentation](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/muxers.texi), [protocol source documentation](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/protocols.texi). The local FFmpeg 7.1 build's protocol help confirmed RTMP `listen`, initial `timeout` and TCP support. This task does not add an npm dependency or install a media server.

## Verification performed

`tests/live-ingest.test.js` includes deterministic process, filesystem and store checks for fixed loopback arguments; finalized-only staging; saved media/moment before a failed callback; original project targeting; credential omission; short final windows; input/ownership limits; low disk space; cancellation; restart recovery and monotonically appended captured clocks.

The optional real test was run successfully with approved localhost socket access:

```sh
LIVE_INGEST_REAL=1 node --test tests/live-ingest.test.js
```

The real FFmpeg sender generated **27 seconds of synthetic 320×180 video and sine-wave audio**, sent them over localhost RTMP, and ended. The receiver saved a roughly 24-second window and a final short window. Every saved MP4 was probed for video dimensions, audio presence and positive duration; session elapsed clocks and saved project moments matched. A separate real-process test ended the application liveness pipe and verified that the supervisor stopped FFmpeg and left a finalized short MP4, rather than a continuing encoder. These validate short real process/media paths, not sustained six-hour operation, real OBS usability, audible speaker fidelity or public-platform ingestion.

The first sandboxed socket attempt was denied by filesystem/network sandbox restrictions. The subsequent approved unsandboxed localhost-only run passed. No external platform connection, published broadcast, external stream credential, proprietary source footage or paid model call was used.

Still required before calling it production-ready: real OBS setup/audio checks, a sustained stream under CPU/disk load, forced power/process termination, a full six-hour/budget stress run, target-device playback, app route/UI integration and any downstream analysis/review/export flow.
