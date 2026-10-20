#!/usr/bin/env python3
"""Studio Yebisu / livetalking-example: deterministic manual avatar preparation.

Reads the protected 512x512 RGB Mona Lisa crop (the same file reused from the
earlier LivePortrait example; public-domain painting, not a newly generated
portrait) and writes into an empty --output directory:

  face256.png                    manual 320px box [100,40,420,360] resized to 256x256
                                 with OpenCV INTER_LANCZOS4 (8-bit RGB PNG)
  mask320.png                    declared manual lower-half blending mask, 320x320,
                                 three identical channels
  face256-upper-half-masked.png  diagnostic only: face256 with rows 128..255 set to 0,
                                 the same half mask original VAE.get_latents_for_unet
                                 applies before encoding the masked latent
  preparation.json               exact box, mask rule, algorithm, hashes, dimensions

This is a preparation helper. It runs no face detector, landmark model or neural
face parser, generates no image content, and never rewrites the protected input.
The full 512 painting stays the output canvas and is not copied here.

Usage:
  python prepare_input.py --input inputs/portrait.png --output inputs/prepared
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from pathlib import Path
from typing import NoReturn

import cv2
import numpy as np

PROTECTED_PORTRAIT_SHA256 = "15f01c4ad2bf8ae01a696c5c3da39ecbd2ac68a8f563e0d46a44c122f30e359b"
CANVAS_SIZE = 512
BBOX_XYXY = (100, 40, 420, 360)
FACE_SIZE = 256
MASK_SIZE = 320
MASK_RAMP_START = 160
MASK_RAMP_ROWS = 12


def fail(message: str) -> NoReturn:
    print(f"prepare_input: {message}", file=sys.stderr)
    sys.exit(2)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_mask() -> tuple[np.ndarray, list[int]]:
    """Rows 0..159 = 0, rows 160..171 = linear 0..255 inclusive, rows 172..319 = 255."""
    ramp = np.rint(np.linspace(0.0, 255.0, MASK_RAMP_ROWS)).astype(np.uint8)
    gray = np.zeros((MASK_SIZE, MASK_SIZE), dtype=np.uint8)
    gray[MASK_RAMP_START:MASK_RAMP_START + MASK_RAMP_ROWS, :] = ramp[:, None]
    gray[MASK_RAMP_START + MASK_RAMP_ROWS:, :] = 255
    return np.ascontiguousarray(np.repeat(gray[:, :, None], 3, axis=2)), [int(v) for v in ramp]


def write_png(path: Path, array: np.ndarray) -> dict:
    if not cv2.imwrite(str(path), array):
        fail(f"OpenCV could not write {path.name}")
    data = path.read_bytes()
    reread = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if reread is None or reread.shape != array.shape or not np.array_equal(reread, array):
        fail(f"{path.name} did not decode back to the exact written pixels")
    return {
        "file": path.name,
        "sha256": sha256_bytes(data),
        "bytes": len(data),
        "height": int(array.shape[0]),
        "width": int(array.shape[1]),
        "channels": int(array.shape[2]),
        "dtype": str(array.dtype),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Manual, deterministic avatar preparation (no detector/parser).")
    parser.add_argument("--input", required=True, type=Path, help="protected 512x512 RGB portrait.png")
    parser.add_argument("--output", required=True, type=Path, help="new or empty directory, e.g. inputs/prepared")
    args = parser.parse_args(argv)

    src = args.input.resolve()
    out = args.output.resolve()
    if not src.is_file():
        fail("input file not found")
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        fail("refusing: output exists and is not an empty directory")
    if out == src.parent or out in src.parents:
        fail("refusing: output must not be the protected input's directory")

    raw = src.read_bytes()
    source_sha256 = sha256_bytes(raw)
    if source_sha256 != PROTECTED_PORTRAIT_SHA256:
        fail("input sha256 does not match the protected portrait; refusing to prepare a different image")
    canvas = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_UNCHANGED)
    if canvas is None or canvas.dtype != np.uint8 or canvas.shape != (CANVAS_SIZE, CANVAS_SIZE, 3):
        fail("input is not an 8-bit three-channel 512x512 image")

    x1, y1, x2, y2 = BBOX_XYXY
    crop = canvas[y1:y2, x1:x2]
    if crop.shape != (MASK_SIZE, MASK_SIZE, 3):
        fail(f"manual box produced {crop.shape}, expected 320x320x3")
    face = cv2.resize(crop, (FACE_SIZE, FACE_SIZE), interpolation=cv2.INTER_LANCZOS4)
    masked_face = face.copy()
    masked_face[FACE_SIZE // 2:, :, :] = 0
    mask, ramp = build_mask()

    out.mkdir(parents=True, exist_ok=True)
    face_info = write_png(out / "face256.png", face)
    mask_info = write_png(out / "mask320.png", mask)
    masked_info = write_png(out / "face256-upper-half-masked.png", masked_face)

    preparation = {
        "schema": "studio-yebisu/livetalking-example/preparation@1",
        "tool": "prepare_input.py",
        "tool_sha256": sha256_bytes(Path(__file__).resolve().read_bytes()),
        "tool_role": "deterministic preparation helper; no face detection, landmarks, segmentation or neural face parsing",
        "source": {
            "file": src.name,
            "sha256": source_sha256,
            "bytes": len(raw),
            "height": CANVAS_SIZE,
            "width": CANVAS_SIZE,
            "channels": 3,
            "provenance": "same 512 RGB Mona Lisa crop reused byte-exact from the prior LivePortrait example; "
                          "the original painting is public domain; not a newly generated portrait",
            "role": "output canvas for the original paste-back; not modified or copied by this helper",
        },
        "bbox_xyxy": list(BBOX_XYXY),
        "bbox_size": [x2 - x1, y2 - y1],
        "bbox_origin": "manual operator-designated box, not a detector result",
        "crop": {
            "operation": f"canvas[{y1}:{y2}, {x1}:{x2}] (rows y1:y2, columns x1:x2)",
            "resize": {
                "library": "OpenCV",
                "function": "cv2.resize",
                "interpolation": "INTER_LANCZOS4",
                "from": [x2 - x1, y2 - y1],
                "to": [FACE_SIZE, FACE_SIZE],
            },
            "storage": "8-bit RGB PNG; OpenCV loads it as BGR, which original VAE.get_latents_for_unet expects for ndarray input",
            "output": face_info,
        },
        "mask": {
            "purpose": "declared manual lower-half blending mask for original get_image_blending; not neural face parsing",
            "rule": {
                "rows_0_159": 0,
                "rows_160_171": "np.rint(np.linspace(0, 255, 12)) per row, constant across columns",
                "rows_172_319": 255,
            },
            "ramp_values_rows_160_171": ramp,
            "channels": "three identical channels (original myutil.get_image_blending converts BGR to gray)",
            "mask_coords_xyxy": list(BBOX_XYXY),
            "output": mask_info,
        },
        "diagnostics": {
            "upper_half_masked_face": {
                "operation": "face256 copy with rows 128..255 set to 0, mirroring the half mask in original VAE.preprocess_img(half_mask=True)",
                "role": "visual check of the deterministic input to the masked-latent path; not a model output",
                "output": masked_info,
            },
        },
        "versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "opencv": cv2.__version__,
        },
    }
    (out / "preparation.json").write_text(json.dumps(preparation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if sha256_bytes(src.read_bytes()) != source_sha256:
        fail("protected input changed during preparation")
    print(f"prepare_input: wrote {face_info['file']}, {mask_info['file']}, {masked_info['file']}, preparation.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
