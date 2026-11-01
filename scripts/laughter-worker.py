"""Laughter classifier for the live buffer.

Reads one 16 kHz mono WAV path per line on stdin and writes one JSON line:
{"laughter": <highest laughter-family score 0-1>, "top": <top YAMNet label>}.
Runs YAMNet (Apache-2.0, MediaPipe build) with LiteRT, installed by
npm run setup:laughter into .runtime/laughter and .runtime/models.
"""
import json
import os
import sys
import wave
import zipfile

root = sys.argv[1]
sys.path.insert(0, os.path.join(root, "laughter"))
import numpy as np  # noqa: E402
from ai_edge_litert.interpreter import Interpreter  # noqa: E402

model = os.path.join(root, "models", "yamnet.tflite")
labels = zipfile.ZipFile(model).read("yamnet_label_list.txt").decode().splitlines()
laugh = [i for i, name in enumerate(labels) if name in {"Laughter", "Baby laughter", "Giggle", "Snicker", "Belly laugh", "Chuckle, chortle"}]
interpreter = Interpreter(model_path=model)
interpreter.allocate_tensors()
source = interpreter.get_input_details()[0]
scores = interpreter.get_output_details()[0]
frame = int(source["shape"][-1])

for line in sys.stdin:
    result = {"laughter": 0.0, "top": ""}
    try:
        with wave.open(line.strip()) as audio:
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if len(samples) < frame:
            samples = np.pad(samples, (0, frame - len(samples)))
        best = 0.0
        top = ""
        for start in range(0, len(samples) - frame + 1, frame // 2):
            interpreter.set_tensor(source["index"], samples[start:start + frame].reshape(source["shape"]))
            interpreter.invoke()
            out = interpreter.get_tensor(scores["index"]).reshape(-1)
            value = float(out[laugh].max())
            if value > best:
                best, top = value, labels[int(out.argmax())]
        result = {"laughter": round(best, 3), "top": top}
    except Exception:  # A bad segment must not stop the worker.
        pass
    sys.stdout.write(json.dumps(result) + "\n")
    sys.stdout.flush()
