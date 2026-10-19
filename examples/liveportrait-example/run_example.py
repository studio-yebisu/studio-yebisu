"""Run the LivePortrait HUMAN core subset on one manually cropped portrait.

Author runner (Studio Yebisu), executed separately by the production operator.
It imports the original, unmodified LivePortraitWrapper and InferenceConfig from
a full pinned upstream checkout and calls only these original methods:

    LivePortraitWrapper(cfg)            once  (loads F, M, W, G and the S checkpoint)
    prepare_source(img)                 once  (original 512 -> 256 resize)
    get_kp_info(x)                      once
    extract_feature_3d(x)               once  (single appearance feature, reused)
    transform_keypoint(source_info)     once  (shared x_source)
    per frame (2 jobs x 36 frames):
      transform_keypoint(target_info) -> stitching(x_source, x_target)
      -> warp_decode(feature, x_source, x_stitched) -> parse_output(out['out'])[0]

target_info is a clone of the inferred source_info with a scheduled scalar added
to the inferred yaw (degrees). Every other inferred value is kept. Not executed:
LivePortraitPipeline / inference.py / Gradio, cropper and face detection, driving
video, audio, eye/lip ratio retargeting, pasteback, animal mode.

Outputs:
  --frames-dir  private: all 36 PNG frames per job + pre/post-stitch keypoint arrays
  --output      public: 5 representative PNG copies per job, one MP4 per job, results.json

Nothing in results.json is prepopulated; it is written only after every check
in this file has passed. On any exception the run stops and partial artifacts
are left in place without results.json.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import inspect
import json
import math
import platform
import random
import shutil
import subprocess
import sys
import time
from collections import Counter
from importlib import metadata
from pathlib import Path

import cv2
import numpy as np
import PIL
import torch
import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent

SCHEDULE = "round(amplitude_degrees*sin(2*pi*i/(frames-1)),6)"
EXPECTED_JOB_IDS = ["yaw08", "yaw16"]
EXPECTED_AMPLITUDES = [8, 16]
KEPT_FROM_SOURCE = ["kp", "pitch", "roll", "scale", "t", "exp"]
SOURCE_INFO_KEYS = {"pitch", "yaw", "roll", "t", "exp", "scale", "kp"}
CHECKPOINT_KEYS = ["checkpoint_F", "checkpoint_M", "checkpoint_W", "checkpoint_G", "checkpoint_S"]
OPENCV_DISTRIBUTIONS = ["opencv-python", "opencv-python-headless", "opencv-contrib-python", "opencv-contrib-python-headless"]


def fail(message: str) -> None:
    raise SystemExit(f"run_example: {message}")


def load_prepare_input():
    spec = importlib.util.spec_from_file_location("prepare_input", HERE / "prepare_input.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git_blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def tensor_f32(t: torch.Tensor) -> np.ndarray:
    return np.ascontiguousarray(t.detach().cpu().numpy(), dtype="<f4")


def tensor_sha256(t: torch.Tensor) -> str:
    return sha256_bytes(tensor_f32(t).tobytes())


def require_finite(name: str, t: torch.Tensor) -> None:
    if not bool(torch.isfinite(t).all()):
        fail(f"non-finite values in {name}")


def yaw_offsets(amplitude: float, frames: int) -> list[float]:
    offsets = []
    for i in range(frames):
        if i == 0 or i == frames - 1:
            offsets.append(0.0)
        else:
            offsets.append(round(amplitude * math.sin(2 * math.pi * i / (frames - 1)), 6) + 0.0)
    return offsets


def first_line(cmd: list[str]) -> str:
    out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
    return out.splitlines()[0] if out else ""


def mp4_top_level_boxes(path: Path) -> list[str]:
    boxes = []
    size_total = path.stat().st_size
    with path.open("rb") as f:
        pos = 0
        while pos < size_total:
            f.seek(pos)
            header = f.read(8)
            if len(header) < 8:
                break
            size, kind = struct_unpack_box(header)
            if size == 1:
                size = int.from_bytes(f.read(8), "big")
            elif size == 0:
                size = size_total - pos
            if size < 8:
                fail(f"malformed MP4 box in {path.name}")
            boxes.append(kind)
            pos += size
    return boxes


def struct_unpack_box(header: bytes) -> tuple[int, str]:
    return int.from_bytes(header[:4], "big"), header[4:8].decode("latin-1")


# ---------------------------------------------------------------- validation

def validate_jobs(spec: dict, prepare_input) -> None:
    jobs = spec["jobs"]
    if [j["id"] for j in jobs] != EXPECTED_JOB_IDS:
        fail("jobs.json must contain exactly yaw08, yaw16 in order")
    if [j["control"]["amplitude_degrees"] for j in jobs] != EXPECTED_AMPLITUDES:
        fail("unexpected amplitudes")
    if {j["source"] for j in jobs} != {spec["source"]["prepared"]}:
        fail("both jobs must use the same prepared source")
    for j in jobs:
        c = j["control"]
        if (j["frames"], j["fps"], j["stitching"]) != (36, 12, True):
            fail(f"{j['id']}: expected 36 frames, 12 fps, stitching enabled")
        if c["parameter"] != "yaw" or c["schedule"] != SCHEDULE or c["first_and_last_offset"] != 0.0:
            fail(f"{j['id']}: unexpected control specification")
        if j["kept_from_source_inference"] != KEPT_FROM_SOURCE:
            fail(f"{j['id']}: unexpected kept source values")

    rt = spec["runtime"]
    expected_rt = {
        "device": "cpu", "dtype": "float32", "flag_force_cpu": True,
        "flag_use_half_precision": False, "flag_do_torch_compile": False, "flag_stitching": True,
        "torch_intra_op_threads": 4, "torch_inter_op_threads": 4, "seed": 20261020,
    }
    if rt != expected_rt:
        fail("unexpected runtime section")

    prep = spec["source"]["preparation"]
    if tuple(prep["crop_box_pil_edges"]) != prepare_input.CROP_BOX:
        fail("crop box in jobs.json differs from prepare_input.py")
    if tuple(prep["output_size"]) != prepare_input.OUTPUT_SIZE or prep["resample"] != prepare_input.RESAMPLE_NAME:
        fail("preparation size/resample in jobs.json differs from prepare_input.py")
    if spec["source"]["original_sha256"] != prepare_input.EXPECTED_SOURCE_SHA256:
        fail("source hash in jobs.json differs from prepare_input.py")

    if [w["config_key"] for w in spec["weights"]["files"]] != CHECKPOINT_KEYS:
        fail("weights section must list checkpoint_F, M, W, G, S")

    idx = spec["public_frame_indices"]
    if idx != sorted(set(idx)) or any(not 0 <= i < 36 for i in idx):
        fail("invalid public frame indices")

    v = spec["video"]
    if (v["codec"], v["pix_fmt"], v["movflags"], v["audio"]) != ("libx264", "yuv420p", "+faststart", False):
        fail("unexpected video section")


def check_environment(expected: dict) -> dict:
    opencv_dist = None
    opencv_dist_name = None
    for name in OPENCV_DISTRIBUTIONS:
        try:
            opencv_dist = metadata.version(name)
            opencv_dist_name = name
            break
        except metadata.PackageNotFoundError:
            continue
    measured = {
        "python": platform.python_version(),
        "torch": str(torch.__version__),
        "numpy": np.__version__,
        "Pillow": PIL.__version__,
        "opencv": cv2.__version__,
        "scipy": metadata.version("scipy"),
        "PyYAML": yaml.__version__,
        "rich": metadata.version("rich"),
    }
    for key, value in measured.items():
        if value != expected[key]:
            fail(f"environment {key} is {value}, expected {expected[key]}")
    if opencv_dist is not None and opencv_dist != expected["opencv_distribution"]:
        fail(f"{opencv_dist_name} is {opencv_dist}, expected {expected['opencv_distribution']}")
    measured["opencv_distribution"] = {"name": opencv_dist_name, "version": opencv_dist}
    return measured


def check_dirs(output: Path, frames_dir: Path, job_ids: list[str]) -> None:
    if output.exists():
        if not output.is_dir():
            fail("--output exists and is not a directory")
        if any(output.iterdir()):
            fail("refusing nonempty --output directory")
    if frames_dir == output or frames_dir.is_relative_to(output) or output.is_relative_to(frames_dir):
        fail("--frames-dir must be separate from --output (full frames stay private)")
    if frames_dir.exists() and not frames_dir.is_dir():
        fail("--frames-dir exists and is not a directory")
    for job_id in job_ids:
        if (frames_dir / job_id).exists():
            fail(f"refusing existing frames job directory: {job_id}")


def verify_upstream(upstream: Path, files: list[dict]) -> list[dict]:
    records = []
    for entry in files:
        path = upstream / entry["path"]
        if not path.is_file():
            fail(f"upstream file missing: {entry['path']}")
        blob = git_blob_sha1(path)
        if blob != entry["git_blob"]:
            fail(f"upstream file {entry['path']} git blob {blob} != pinned {entry['git_blob']}")
        records.append({"path": entry["path"], "git_blob": blob, "sha256": sha256_file(path)})
    return records


def verify_weights(weights: Path, files: list[dict]) -> list[dict]:
    records = []
    for entry in files:
        path = weights / entry["path"]
        if not path.is_file():
            fail(f"weight file missing: {entry['path']}")
        size = path.stat().st_size
        digest = sha256_file(path)
        if size != entry["bytes"] or digest != entry["sha256"]:
            fail(f"weight file {entry['path']} does not match the pinned bytes/sha256")
        records.append({"config_key": entry["config_key"], "path": entry["path"], "bytes": size, "sha256": digest})
    return records


# ---------------------------------------------------------------- main

def main() -> int:
    parser = argparse.ArgumentParser(description="LivePortrait HUMAN core subset: manual yaw schedule on one portrait")
    parser.add_argument("--upstream", type=Path, required=True, help="full LivePortrait checkout at the pinned revision")
    parser.add_argument("--weights", type=Path, required=True, help="KlingTeam/LivePortrait weights root (contains liveportrait/)")
    parser.add_argument("--jobs", type=Path, required=True, help="inputs/jobs.json")
    parser.add_argument("--output", type=Path, required=True, help="public output directory (must be empty or absent)")
    parser.add_argument("--frames-dir", type=Path, required=True, help="private directory for all generated frames")
    args = parser.parse_args()

    t_total = time.perf_counter()
    timings: dict = {}

    upstream = args.upstream.resolve()
    weights = args.weights.resolve()
    jobs_path = args.jobs.resolve()
    output = args.output.resolve()
    frames_dir = args.frames_dir.resolve()
    case_root = jobs_path.parent.parent

    jobs_bytes = jobs_path.read_bytes()
    spec = json.loads(jobs_bytes)
    prepare_input = load_prepare_input()
    validate_jobs(spec, prepare_input)
    job_specs = spec["jobs"]
    job_ids = [j["id"] for j in job_specs]
    fps = 12
    public_indices = spec["public_frame_indices"]
    rt = spec["runtime"]

    check_dirs(output, frames_dir, job_ids)

    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    if ffmpeg is None or ffprobe is None:
        fail("ffmpeg and ffprobe must be on PATH")

    torch.set_num_threads(rt["torch_intra_op_threads"])
    torch.set_num_interop_threads(rt["torch_inter_op_threads"])
    random.seed(rt["seed"])
    np.random.seed(rt["seed"])
    torch.manual_seed(rt["seed"])

    environment = check_environment(spec["environment"])
    environment.update({
        "implementation": platform.python_implementation(),
        "os": platform.system(),
        "machine": platform.machine(),
        "torch_intra_op_threads": torch.get_num_threads(),
        "torch_inter_op_threads": torch.get_num_interop_threads(),
        "ffmpeg": first_line([ffmpeg, "-version"]),
        "ffprobe": first_line([ffprobe, "-version"]),
    })
    if environment["torch_intra_op_threads"] != 4 or environment["torch_inter_op_threads"] != 4:
        fail("torch thread settings did not take effect")

    # -------------------------------------------------------- preflight pins
    t0 = time.perf_counter()
    upstream_records = verify_upstream(upstream, spec["upstream"]["verified_files"])
    weight_records = verify_weights(weights, spec["weights"]["files"])

    original_rel = spec["source"]["original"]
    crop_rel = spec["source"]["prepared"]
    original_path = case_root / original_rel
    crop_path = case_root / crop_rel
    if not crop_path.is_file():
        fail(f"missing prepared source {crop_rel}; run prepare_input.py first")
    rederived, original_info = prepare_input.prepare_crop(original_path)
    with Image.open(crop_path) as im:
        im.load()
        crop_format, crop_mode, crop_size = im.format, im.mode, list(im.size)
        crop_pixels = np.array(im)
    if crop_format != "PNG" or crop_mode != "RGB" or crop_size != [512, 512]:
        fail(f"prepared source is {crop_format} {crop_mode} {crop_size}, expected PNG RGB 512x512")
    rederived_equal = bool(np.array_equal(np.array(rederived), crop_pixels))
    if not rederived_equal:
        fail("prepared source pixels differ from the crop re-derived from the original")
    timings["preflight_hashing_seconds"] = time.perf_counter() - t0

    # -------------------------------------------------------- original upstream imports
    sys.path.insert(0, str(upstream))
    from src.config.inference_config import InferenceConfig  # noqa: E402  (original, unmodified)
    from src.live_portrait_wrapper import LivePortraitWrapper  # noqa: E402  (original, unmodified)

    for obj in (InferenceConfig, LivePortraitWrapper):
        origin = Path(inspect.getfile(obj)).resolve()
        if not origin.is_relative_to(upstream):
            fail(f"{obj.__name__} was not imported from --upstream")

    weight_paths = {w["config_key"]: str(weights / w["path"]) for w in spec["weights"]["files"]}
    cfg = InferenceConfig(
        models_config=str(upstream / spec["upstream"]["models_config"]),
        checkpoint_F=weight_paths["checkpoint_F"],
        checkpoint_M=weight_paths["checkpoint_M"],
        checkpoint_W=weight_paths["checkpoint_W"],
        checkpoint_G=weight_paths["checkpoint_G"],
        checkpoint_S=weight_paths["checkpoint_S"],
        flag_use_half_precision=rt["flag_use_half_precision"],
        flag_force_cpu=rt["flag_force_cpu"],
        flag_do_torch_compile=rt["flag_do_torch_compile"],
        flag_stitching=rt["flag_stitching"],
    )

    # Counted at the call boundary in this runner: a call counts once it returns.
    calls: Counter = Counter()

    def call(name, fn, *a):
        result = fn(*a)
        calls[name] += 1
        return result

    # -------------------------------------------------------- load
    t0 = time.perf_counter()
    wrapper = call("LivePortraitWrapper", LivePortraitWrapper, cfg)
    timings["load_seconds"] = time.perf_counter() - t0

    if wrapper.device != "cpu" or wrapper.compile:
        fail("wrapper is not on CPU without torch.compile")
    srm = wrapper.stitching_retargeting_module
    if not isinstance(srm, dict) or set(srm) != {"stitching", "lip", "eye"}:
        fail("stitching_retargeting_module was not loaded")
    networks = {
        "appearance_feature_extractor": wrapper.appearance_feature_extractor,
        "motion_extractor": wrapper.motion_extractor,
        "warping_module": wrapper.warping_module,
        "spade_generator": wrapper.spade_generator,
        "stitching_retargeting_module.stitching": srm["stitching"],
        "stitching_retargeting_module.lip": srm["lip"],
        "stitching_retargeting_module.eye": srm["eye"],
    }
    network_records = {}
    for name, net in networks.items():
        dtypes = sorted({str(p.dtype) for p in net.parameters()})
        if dtypes != ["torch.float32"]:
            fail(f"{name} parameters are {dtypes}, expected float32")
        network_records[name] = {
            "parameters": int(sum(p.numel() for p in net.parameters())),
            "dtype": "float32",
            "executed": name not in ("stitching_retargeting_module.lip", "stitching_retargeting_module.eye"),
        }

    # -------------------------------------------------------- source stage (shared by both jobs)
    jobs_out = []
    with torch.no_grad():
        t0 = time.perf_counter()
        img = np.ascontiguousarray(crop_pixels)
        x = call("prepare_source", wrapper.prepare_source, img)
        source_info = call("get_kp_info", wrapper.get_kp_info, x)
        feature = call("extract_feature_3d", wrapper.extract_feature_3d, x)
        x_source = call("transform_keypoint", wrapper.transform_keypoint, source_info)
        timings["source_stage_seconds"] = time.perf_counter() - t0

        if set(source_info) != SOURCE_INFO_KEYS:
            fail(f"unexpected get_kp_info keys {sorted(source_info)}")
        for key, value in source_info.items():
            require_finite(f"source_info[{key}]", value)
        require_finite("feature_3d", feature)
        require_finite("x_source", x_source)
        if feature.dtype != torch.float32 or x_source.shape != (1, 21, 3):
            fail("unexpected feature dtype or x_source shape")
        feature_sha_before = tensor_sha256(feature)

        source_record = {
            "prepare_source_tensor_shape": list(x.shape),
            "get_kp_info_shapes": {k: list(v.shape) for k, v in sorted(source_info.items())},
            "pose_degrees": {k: float(source_info[k].item()) for k in ("pitch", "yaw", "roll")},
            "scale": source_info["scale"].reshape(-1).tolist(),
            "t": source_info["t"].reshape(-1).tolist(),
            "kp_canonical_21x3": source_info["kp"][0].tolist(),
            "exp_21x3": source_info["exp"][0].tolist(),
            "x_source_21x3": x_source[0].tolist(),
            "x_source_sha256_f32le": tensor_sha256(x_source),
            "feature_3d": {"shape": list(feature.shape), "dtype": "float32", "sha256_f32le": feature_sha_before},
        }

        # ---------------------------------------------------- per-job frames
        warp_shapes_ref = None
        for job in job_specs:
            job_id = job["id"]
            n = job["frames"]
            offsets = yaw_offsets(job["control"]["amplitude_degrees"], n)
            job_dir = frames_dir / job_id
            job_dir.mkdir(parents=True, exist_ok=False)

            pre_all = np.zeros((n, 21, 3), dtype="<f4")
            post_all = np.zeros((n, 21, 3), dtype="<f4")
            frame_records = []
            gen_seconds = 0.0
            png_seconds = 0.0

            for i, offset in enumerate(offsets):
                target_info = {k: v.clone() for k, v in source_info.items()}
                target_info["yaw"] = target_info["yaw"] + offset

                t0 = time.perf_counter()
                x_target = call("transform_keypoint", wrapper.transform_keypoint, target_info)
                x_stitched = call("stitching", wrapper.stitching, x_source, x_target)
                out = call("warp_decode", wrapper.warp_decode, feature, x_source, x_stitched)
                frame = call("parse_output", wrapper.parse_output, out["out"])[0]
                gen_seconds += time.perf_counter() - t0

                raw = out["out"]
                require_finite(f"{job_id}[{i}] x_target", x_target)
                require_finite(f"{job_id}[{i}] x_stitched", x_stitched)
                require_finite(f"{job_id}[{i}] warp_decode out", raw)
                warp_shapes = {k: (list(v.shape) if isinstance(v, torch.Tensor) else None) for k, v in sorted(out.items())}
                if warp_shapes_ref is None:
                    warp_shapes_ref = warp_shapes
                elif warp_shapes != warp_shapes_ref:
                    fail(f"{job_id}[{i}] warp_decode shapes changed")
                if frame.shape != (512, 512, 3) or frame.dtype != np.uint8:
                    fail(f"{job_id}[{i}] parse_output gave {frame.shape} {frame.dtype}")

                pre = tensor_f32(x_target)[0]
                post = tensor_f32(x_stitched)[0]
                pre_all[i] = pre
                post_all[i] = post
                correction = post - pre
                raw_np = raw.detach().cpu().numpy()

                t0 = time.perf_counter()
                png_path = job_dir / f"frame-{i:06d}.png"
                image = Image.fromarray(frame)
                if image.mode != "RGB":
                    fail(f"{job_id}[{i}] frame mode {image.mode}")
                with png_path.open("xb") as f:
                    image.save(f, format="PNG")
                png_seconds += time.perf_counter() - t0

                frame_records.append({
                    "index": i,
                    "time_seconds": round(i / fps, 6),
                    "yaw_offset_degrees": offset,
                    "target_yaw_degrees": float(target_info["yaw"].item()),
                    "keypoints": {
                        "pre_stitch_sha256_f32le": sha256_bytes(pre.tobytes()),
                        "post_stitch_sha256_f32le": sha256_bytes(post.tobytes()),
                        "pre_stitch_max_abs_diff_from_x_source": float(np.abs(pre - tensor_f32(x_source)[0]).max()),
                        "stitch_correction_max_abs": float(np.abs(correction).max()),
                        "stitch_correction_mean_abs": float(np.abs(correction).mean()),
                    },
                    "decoder_out_before_parse_output": {
                        "min": float(raw_np.min()),
                        "max": float(raw_np.max()),
                        "fraction_outside_0_1": float(((raw_np < 0) | (raw_np > 1)).mean()),
                    },
                    "png": {
                        "private_path": f"<frames-dir>/{job_id}/frame-{i:06d}.png",
                        "bytes": png_path.stat().st_size,
                        "sha256": sha256_file(png_path),
                        "size": [512, 512],
                        "mode": "RGB",
                    },
                })

            arrays = {}
            for name, arr in (("keypoints-pre-stitch.npy", pre_all), ("keypoints-post-stitch.npy", post_all)):
                path = job_dir / name
                with path.open("xb") as f:
                    np.save(f, arr)
                arrays[name] = {"private_path": f"<frames-dir>/{job_id}/{name}", "shape": list(arr.shape),
                                "dtype": "float32", "sha256": sha256_file(path)}

            jobs_out.append({
                "id": job_id,
                "source": job["source"],
                "amplitude_degrees": job["control"]["amplitude_degrees"],
                "schedule": SCHEDULE,
                "frames": n,
                "fps": fps,
                "stitching": True,
                "yaw_offsets_degrees": offsets,
                "keypoint_arrays_private": arrays,
                "frame_records": frame_records,
                "timings_seconds": {"generation_wrapper_calls": gen_seconds, "png_write": png_seconds},
            })

        feature_sha_after = tensor_sha256(feature)
        source_record["feature_3d"]["sha256_f32le_after_all_frames"] = feature_sha_after
        if feature_sha_after != feature_sha_before:
            fail("shared appearance feature changed during generation")

    n_total = sum(j["frames"] for j in job_specs)
    expected_calls = {
        "LivePortraitWrapper": 1, "prepare_source": 1, "get_kp_info": 1, "extract_feature_3d": 1,
        "transform_keypoint": 1 + n_total, "stitching": n_total, "warp_decode": n_total, "parse_output": n_total,
    }
    if dict(calls) != expected_calls:
        fail(f"call counts {dict(calls)} != {expected_calls}")

    # -------------------------------------------------------- encode, probe, publish
    output.mkdir(parents=True, exist_ok=True)
    for job in jobs_out:
        job_id = job["id"]
        job_dir = frames_dir / job_id
        mp4 = output / f"{job_id}.mp4"
        encode_args = [
            "-hide_banner", "-nostdin", "-loglevel", "error", "-n",
            "-framerate", str(fps), "-start_number", "0", "-i", "{frames}/frame-%06d.png",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
            "{mp4}",
        ]
        cmd = [ffmpeg] + [a.replace("{frames}", str(job_dir)).replace("{mp4}", str(mp4)) for a in encode_args]
        t0 = time.perf_counter()
        subprocess.run(cmd, check=True)
        encode_seconds = time.perf_counter() - t0

        t0 = time.perf_counter()
        probe_raw = subprocess.run(
            [ffprobe, "-v", "error", "-count_frames",
             "-show_entries",
             "stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration"
             ":format=format_name,duration,size",
             "-of", "json", str(mp4)],
            check=True, capture_output=True, text=True,
        ).stdout
        probe_seconds = time.perf_counter() - t0
        probe = json.loads(probe_raw)
        streams = probe.get("streams", [])
        video = [s for s in streams if s.get("codec_type") == "video"]
        audio = [s for s in streams if s.get("codec_type") == "audio"]
        if len(video) != 1 or audio:
            fail(f"{job_id}.mp4 has {len(video)} video and {len(audio)} audio streams")
        v = video[0]
        if (v.get("width"), v.get("height")) != (512, 512):
            fail(f"{job_id}.mp4 is {v.get('width')}x{v.get('height')}")
        if str(v.get("nb_read_frames")) != str(job["frames"]):
            fail(f"{job_id}.mp4 decoded {v.get('nb_read_frames')} frames")
        if v.get("codec_name") != "h264" or v.get("pix_fmt") != "yuv420p" or v.get("avg_frame_rate") != f"{fps}/1":
            fail(f"{job_id}.mp4 stream is {v.get('codec_name')} {v.get('pix_fmt')} {v.get('avg_frame_rate')}")
        boxes = mp4_top_level_boxes(mp4)
        moov_first = "moov" in boxes and "mdat" in boxes and boxes.index("moov") < boxes.index("mdat")
        if not moov_first:
            fail(f"{job_id}.mp4 moov is not before mdat")

        public_frames = []
        for idx in public_indices:
            src = job_dir / f"frame-{idx:06d}.png"
            rel = f"{job_id}/frames/frame-{idx:06d}.png"
            dst = output / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            data = src.read_bytes()
            with dst.open("xb") as f:
                f.write(data)
            digest = sha256_file(dst)
            if digest != job["frame_records"][idx]["png"]["sha256"]:
                fail(f"public copy {rel} differs from generated frame")
            job["frame_records"][idx]["public_path"] = rel
            public_frames.append({"index": idx, "path": rel, "sha256": digest})

        job["public_frames"] = public_frames
        job["video"] = {
            "path": f"{job_id}.mp4",
            "bytes": mp4.stat().st_size,
            "sha256": sha256_file(mp4),
            "encode_command": ["ffmpeg"] + [a.replace("{frames}", f"<frames-dir>/{job_id}").replace("{mp4}", f"{job_id}.mp4") for a in encode_args],
            "input_frames": f"all {job['frames']} PNG in index order from <frames-dir>/{job_id}",
            "ffprobe": {"streams": streams, "format": probe.get("format", {})},
            "video_streams": len(video),
            "audio_streams": len(audio),
            "decoded_frames": int(v["nb_read_frames"]),
            "width": v["width"],
            "height": v["height"],
            "stream_duration_seconds": float(v["duration"]) if "duration" in v else None,
            "top_level_boxes": boxes,
            "moov_before_mdat": moov_first,
        }
        job["timings_seconds"]["ffmpeg_encode"] = encode_seconds
        job["timings_seconds"]["ffprobe"] = probe_seconds

    timings["total_wall_seconds"] = time.perf_counter() - t_total

    results = {
        "schema": "studio-yebisu/liveportrait-example/results@1",
        "kind": "Measured packaging written by the author runner run_example.py. Not a native LivePortrait output format; contains no model- or author-written prose results.",
        "scope": {
            "executed": "Original LivePortraitWrapper HUMAN core APIs only, on CPU float32, from a full upstream checkout at the pinned revision.",
            "not_executed": [
                "LivePortraitPipeline / inference.py / Gradio app",
                "cropper, InsightFace face detection, landmark.onnx",
                "driving-video motion extraction",
                "audio, lip-sync",
                "eye/lip ratio retargeting (weights loaded with checkpoint_S, networks not called)",
                "pasteback",
                "animal mode",
                "ComfyUI",
            ],
            "motion": "Manual yaw offsets added to the inferred source yaw; offsets are input control values, not measured output head pose.",
            "frame_0": "Generated by warp_decode at offset 0.0 after stitching; it is not the source image.",
            "parse_output": "Original parse_output clips to [0,1] and converts to uint8; PNG frames are those uint8 arrays. MP4 encoding (yuv420p, libx264) is a separate later step.",
            "frames_private": "All frames and keypoint arrays stay in the private --frames-dir; only public_frames and MP4 are in this output directory.",
            "timing": "Wall-clock seconds from one CPU run on the operator machine; not a benchmark.",
        },
        "pins": {
            "upstream": {"repository": spec["upstream"]["repository"], "revision": spec["upstream"]["revision"],
                         "license": spec["upstream"]["license"], "verified_files": upstream_records},
            "weights": {"repository": spec["weights"]["repository"], "revision": spec["weights"]["revision"],
                        "license": spec["weights"]["license"], "files": weight_records},
        },
        "environment": environment,
        "config": {
            "models_config": "<upstream>/" + spec["upstream"]["models_config"],
            "checkpoints": {w["config_key"]: "<weights>/" + w["path"] for w in spec["weights"]["files"]},
            "flag_use_half_precision": cfg.flag_use_half_precision,
            "flag_force_cpu": cfg.flag_force_cpu,
            "flag_do_torch_compile": cfg.flag_do_torch_compile,
            "flag_stitching": cfg.flag_stitching,
            "input_shape": list(cfg.input_shape),
            "device": wrapper.device,
            "seed": rt["seed"],
        },
        "loaded_networks": network_records,
        "jobs_file": {"path": "inputs/jobs.json", "sha256": sha256_bytes(jobs_bytes)},
        "source": {
            "original": {"path": original_rel, **original_info},
            "prepared": {
                "path": crop_rel,
                "bytes": crop_path.stat().st_size,
                "sha256": sha256_file(crop_path),
                "format": crop_format,
                "mode": crop_mode,
                "size": crop_size,
                "rederived_from_original_pixel_equal": rederived_equal,
            },
        },
        "source_inference": source_record,
        "warp_decode_returned_shapes": warp_shapes_ref,
        "calls": dict(calls),
        "calls_counting": "Counted in run_example.py at the wrapper call boundary after each call returned; no internal tracing.",
        "jobs": jobs_out,
        "timings_seconds": timings,
    }

    with (output / "results.json").open("x", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")

    print(f"run_example: wrote {len(jobs_out)} MP4, {len(jobs_out) * len(public_indices)} public PNG and results.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
