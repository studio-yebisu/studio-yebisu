"""Create small, wide sharing images from the already credited videos."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

WIDTH, HEIGHT = 1200, 600
SPEC = 'credited-frame-letterbox-v2'


def asset_path(target, relative):
    target = Path(target).resolve()
    path = (target / relative).resolve()
    if not path.is_relative_to(target):
        raise ValueError(f'Social asset escapes the publication directory: {relative}')
    return path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_image(target, case_id, asset, previous=None):
    source = asset_path(target, asset['path'])
    source_hash = digest(source)
    if source_hash != asset['sha256']:
        raise ValueError(f'Credited source hash changed: {source}')
    # Later scenes show the examples after their introductory reveal.
    frame_time = round(min(24.0, float(asset['duration']) * .75), 3)
    recipe_hash = hashlib.sha256(f'{SPEC}:{source_hash}:{frame_time}'.encode()).hexdigest()[:12]
    relative = f'media/social-cards/{case_id}-{recipe_hash}.jpg'
    output = asset_path(target, relative)
    if (previous and previous.get('spec') == SPEC
            and previous.get('source_sha256') == source_hash
            and previous.get('path') == relative and output.is_file()
            and digest(output) == previous.get('sha256')):
        return previous
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg is required to build the sharing images')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Keep the full frame and its burned-in credit; pad rather than crop.
    filters = (f'scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,'
               f'pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xf4f0e5,setsar=1')
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', str(frame_time), '-i', str(source), '-frames:v', '1',
                    '-vf', filters, '-q:v', '2', '-threads', '1', '-update', '1',
                    str(output)], check=True, capture_output=True)
    return {'case_id': case_id, 'path': relative, 'spec': SPEC,
            'source': asset['path'], 'source_sha256': source_hash,
            'frame_time': frame_time, 'sha256': digest(output),
            'width': WIDTH, 'height': HEIGHT, 'content_type': 'image/jpeg',
            'bytes': output.stat().st_size}


def check_images(target, images, cases):
    expected = {case['id']: case for case in cases}
    assert len(images) == len(expected) and {i['case_id'] for i in images} == set(expected), 'Missing or duplicate sharing images'
    ffprobe = shutil.which('ffprobe')
    if not ffprobe:
        raise RuntimeError('ffprobe is required to check sharing images')
    for image in images:
        path = asset_path(target, image['path'])
        data = path.read_bytes()
        assert data.startswith(b'\xff\xd8') and data.endswith(b'\xff\xd9'), f'Invalid JPEG: {path}'
        assert 0 < len(data) < 5_000_000 and len(data) == image['bytes'], f'Invalid sharing-image size: {path}'
        assert digest(path) == image['sha256'], f'Changed sharing image: {path}'
        result = subprocess.run([ffprobe, '-v', 'error', '-select_streams', 'v:0',
                                 '-show_entries', 'stream=codec_name,width,height',
                                 '-of', 'json', str(path)], check=True, capture_output=True, text=True)
        stream = json.loads(result.stdout)['streams'][0]
        assert stream == {'codec_name': 'mjpeg', 'width': WIDTH, 'height': HEIGHT}, f'Invalid sharing-image dimensions: {path}'
        assert (image['width'], image['height'], image['content_type']) == (WIDTH, HEIGHT, 'image/jpeg')
        assert image['source'] == expected[image['case_id']]['video_download_landscape'], 'Sharing image lost the credited source'
        assert digest(asset_path(target, image['source'])) == image['source_sha256'], 'Sharing image source changed'
