"""Manual portrait crop for the LivePortrait core-subset example.

Author wrapper, not part of upstream LivePortrait. The original pipeline would
locate the face with its cropper (InsightFace + landmark model); this example
does not run detection. Instead it applies one fixed, explicit crop box to the
exact upstream example image assets/examples/source/s9.jpg (a reproduction of
the Mona Lisa) and resizes it to 512x512 RGB with Pillow LANCZOS.

The original input is only read, never modified. An existing output is refused.
Preparation details are printed to stdout as JSON for the operator's record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent

# PIL edge coordinates: (left, upper, right, lower); right/lower are exclusive.
CROP_BOX = (110, 100, 610, 600)
OUTPUT_SIZE = (512, 512)
RESAMPLE_NAME = "LANCZOS"
RESAMPLE = Image.Resampling.LANCZOS

# Exact upstream s9.jpg bytes as copied by the production operator.
EXPECTED_SOURCE_SHA256 = "84a6bfcb3346951cef85c0b0bb07856794e0b04d5b65322c18d77198fbf43f2a"
EXPECTED_SOURCE_GIT_BLOB = "3ef7251ba10bf83356587016b126a52bdbca7b18"
UPSTREAM_SOURCE_PATH = "assets/examples/source/s9.jpg"

EXIF_ORIENTATION_TAG = 0x0112


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def prepare_crop(input_path: Path) -> tuple[Image.Image, dict]:
    """Return the 512x512 RGB crop (in memory) and a description of the input.

    Shared with run_example.py so the runner can re-derive the crop and compare
    pixels against the saved PNG.
    """
    source_sha256 = sha256_file(input_path)
    if source_sha256 != EXPECTED_SOURCE_SHA256:
        raise SystemExit(
            f"refusing: {input_path.name} sha256 {source_sha256} is not the pinned upstream s9.jpg"
        )

    with Image.open(input_path) as im:
        im.load()
        source_format = im.format
        source_mode = im.mode
        source_size = im.size
        orientation = im.getexif().get(EXIF_ORIENTATION_TAG)
        rgb = im.convert("RGB")

    left, upper, right, lower = CROP_BOX
    width, height = source_size
    if not (0 <= left < right <= width and 0 <= upper < lower <= height):
        raise SystemExit(f"refusing: crop box {list(CROP_BOX)} is outside the {width}x{height} input")

    cropped = rgb.crop(CROP_BOX)
    resized = cropped.resize(OUTPUT_SIZE, RESAMPLE)

    info = {
        "upstream_path": UPSTREAM_SOURCE_PATH,
        "sha256": source_sha256,
        "official_git_blob": EXPECTED_SOURCE_GIT_BLOB,
        "bytes": input_path.stat().st_size,
        "format": source_format,
        "mode": source_mode,
        "size": list(source_size),
        "exif_orientation": orientation,
        "exif_orientation_applied": False,
        "crop_box_pil_edges": list(CROP_BOX),
        "crop_size": list(cropped.size),
        "resample": RESAMPLE_NAME,
        "output_size": list(resized.size),
        "output_mode": resized.mode,
    }
    return resized, info


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", type=Path, default=HERE / "inputs" / "mona-lisa-original.jpg")
    parser.add_argument("--output", type=Path, default=HERE / "inputs" / "portrait-crop.png")
    args = parser.parse_args()

    input_path: Path = args.input
    output_path: Path = args.output

    if not input_path.is_file():
        raise SystemExit(f"missing input: {input_path.name}")
    if output_path.exists():
        raise SystemExit(f"refusing: output already exists: {output_path.name}")
    if output_path.resolve() == input_path.resolve():
        raise SystemExit("refusing: output would overwrite the original input")
    if output_path.suffix.lower() != ".png":
        raise SystemExit("refusing: output must be a .png file")
    if not output_path.parent.is_dir():
        raise SystemExit(f"missing output directory for {output_path.name}")

    image, info = prepare_crop(input_path)

    # Exclusive create: never replaces an existing file.
    with output_path.open("xb") as f:
        image.save(f, format="PNG")

    with Image.open(output_path) as check:
        check.load()
        saved_size = list(check.size)
        saved_mode = check.mode
    if saved_size != list(OUTPUT_SIZE) or saved_mode != "RGB":
        raise SystemExit(f"saved PNG is {saved_size} {saved_mode}, expected {list(OUTPUT_SIZE)} RGB")

    record = {
        "tool": "prepare_input.py (author wrapper; manual crop, no face detection)",
        "input": {"name": input_path.name, **info},
        "output": {
            "name": output_path.name,
            "format": "PNG",
            "size": saved_size,
            "mode": saved_mode,
            "bytes": output_path.stat().st_size,
            "sha256": sha256_file(output_path),
        },
    }
    json.dump(record, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
