# Mirror — Live Makeup Assistant

Hackathon prototype: a camera-based, step-by-step makeup routine with opt-in visual guidance from Meta Muse Spark. The camera feed stays in the browser. A compressed still frame is sent to Meta only when **Check this step** is pressed. Frames are not saved by this app.

## Run

Requires Node.js 20 or newer. No package installation is needed.

```sh
cp .env.example .env
# Add a Model API key to .env
npm run dev
```

Open <http://localhost:3000>. Without a key, the routine and camera work, while guidance reports the missing configuration. Camera access works on localhost or HTTPS. Muse Code login does not automatically provide an API key to this app; create a Model API key in the Meta developer dashboard.

## Scope

The prototype offers four guided steps, live camera preview, camera switching, optional questions, and one-frame Muse Spark feedback. It is not a continuous video stream, product recommendation engine, face analysis tool, or medical adviser. The model is asked to comment only on visible application technique and to avoid personal or health inferences.

## API

`POST /api/guide` receives a JPEG data URL, current step, and optional question. The server calls `muse-spark-1.3-contributor` on Meta Model API's chat completions endpoint; the key remains server-side.
