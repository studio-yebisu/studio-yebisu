"""Run the vendored PDF Creator API with an explicit Japanese/Windows adapter.

No replacement renderer: Pandoc, theme/CJK processing, Chrome generation,
typography lint and page previews all run in the original upstream functions.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
UPSTREAM = ROOT / 'vendor/pdf-creator/daymade-docs/pdf-creator/scripts/md_to_pdf.py'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chrome_path(argument):
    candidates = [argument, shutil.which('chrome'), shutil.which('google-chrome'), shutil.which('chromium')]
    if os.name == 'nt':
        for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
            if os.environ.get(variable):
                candidates.append(str(Path(os.environ[variable]) / 'Google/Chrome/Application/chrome.exe'))
    candidates.append('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise SystemExit('Chrome not found. Install Google Chrome or pass --chrome PATH.')


def japanese_font_css(argument):
    """Embed static TrueType instances, avoiding Chrome's Type3 VF output.

    The complete font remains an installed input. Only the renderer's subset
    enters the PDF; full instances and the generated HTML are not distributed.
    """
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    candidates = [argument]
    if os.name == 'nt':
        candidates.append(str(Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts/NotoSansJP-VF.ttf'))
    font_file = next((Path(path) for path in candidates if path and Path(path).is_file()), None)
    if font_file is None:
        raise SystemExit('Install Noto Sans JP or pass --font PATH to its TrueType variable font.')
    face = TTFont(font_file)
    assert 'glyf' in face, 'This reproduction uses a TrueType Noto Sans JP font'
    assert face['OS/2'].fsType == 0, 'Use an embedding-permitted OFL input font'
    assert 'fvar' in face and any(axis.axisTag == 'wght' for axis in face['fvar'].axes), 'Pass a weight-variable TrueType font'
    css = []
    instances = []
    for weight in (400, 700, 800):
        static = instantiateVariableFont(face, {'wght': weight}, inplace=False)
        assert 'fvar' not in static and 'glyf' in static
        stream = io.BytesIO()
        static.save(stream)
        raw = stream.getvalue()
        css.append('@font-face{font-family:"Noto Sans JP";font-style:normal;font-weight:' + str(weight) + ';src:url(data:font/ttf;base64,' + base64.b64encode(raw).decode('ascii') + ') format("truetype");}')
        instances.append({'weight': weight, 'sha256': hashlib.sha256(raw).hexdigest(), 'static_true_type': True, 'full_font_distributed': False})
    return '\n'.join(css), {'source_sha256': digest(font_file), 'license': 'SIL OFL1.1; FONT-OFL.txt', 'instances': instances}


class ScopedSubprocess:
    """Keep stdlib untouched; isolate only the upstream Chrome subprocess."""
    def __init__(self, chrome, profile):
        self.chrome = chrome
        self.profile = profile
        self.chrome_calls = 0

    def __getattr__(self, name):
        return getattr(subprocess, name)

    def run(self, command, **kwargs):
        command = list(command)
        # Windows pdfinfo otherwise localizes date strings using the active
        # code page. Keep its original page-count check, with explicit UTF-8
        # metadata and raw PDF dates rather than locale-dependent dates.
        binary = Path(str(command[0])).stem.lower()
        if binary == 'pdfinfo':
            command[1:1] = ['-enc', 'UTF-8', '-rawdates']
        elif binary == 'pdftotext' and '-enc' not in command:
            command[1:1] = ['-enc', 'UTF-8']
        if kwargs.get('text') and 'encoding' not in kwargs:
            kwargs['encoding'] = 'utf-8'
        return subprocess.run(command, **kwargs)

    def Popen(self, command, **kwargs):
        command = list(command)
        if str(command[0]) == self.chrome:
            assert '--headless' in command and any(str(x).startswith('--print-to-pdf=') for x in command)
            command += ['--user-data-dir=' + self.profile, '--no-first-run', '--lang=ja-JP']
            self.chrome_calls += 1
            if os.name == 'nt':
                kwargs.setdefault('creationflags', subprocess.CREATE_NO_WINDOW)
        return subprocess.Popen(command, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True, help='New output directory; existing directories are rejected.')
    parser.add_argument('--chrome', help='Optional installed Google Chrome/Chromium binary.')
    parser.add_argument('--font', help='Installed Noto Sans JP weight-variable TrueType font; not included.')
    args = parser.parse_args()
    output = args.out.resolve()
    if output.exists():
        raise SystemExit('Output directory exists; choose a new directory.')
    if not shutil.which('pandoc'):
        try:
            import pypandoc
            binary = Path(pypandoc.get_pandoc_path()).resolve()
            os.environ['PATH'] = str(binary.parent) + os.pathsep + os.environ.get('PATH', '')
        except ImportError:
            raise SystemExit('Install pandoc or pypandoc_binary==1.17.')
    for binary in ('pandoc', 'pdftoppm', 'pdftotext', 'pdfinfo'):
        if not shutil.which(binary):
            raise SystemExit('Missing required command: ' + binary)
    chrome = chrome_path(args.chrome)
    font_css, font_report = japanese_font_css(args.font)
    source = ROOT / 'inputs/event.md'
    overrides = {'paper': ROOT / 'themes/japanese-a4.css', 'phone': ROOT / 'themes/japanese-phone.css'}
    assert source.is_file() and all(path.is_file() for path in overrides.values())
    for path in (ROOT, ROOT / 'vendor', ROOT / 'inputs', ROOT / 'themes'):
        assert output != path and not path.is_relative_to(output), 'Unsafe output directory'
    spec = importlib.util.spec_from_file_location('studio_pdf_creator_fixed_upstream', UPSTREAM)
    converter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(converter)
    original_load = converter._load_theme
    original_html = converter._build_full_html
    converter._find_chrome = lambda: chrome
    converter._build_full_html = lambda *args, **kwargs: original_html(*args, **kwargs).replace('<html lang="zh-CN">', '<html lang="ja">', 1)
    output.mkdir(parents=True, exist_ok=False)
    observed = []
    original_digest = digest(UPSTREAM)
    for variant, theme, name in [('paper', 'warm-terra', 'atelier-a4.pdf'), ('phone', 'mobile', 'atelier-phone.pdf')]:
        override = overrides[variant].read_text('utf-8')
        converter._load_theme = lambda selected, extra=override: font_css + '\n' + original_load(selected) + '\n' + extra
        with tempfile.TemporaryDirectory(prefix='studio-pdf-chrome-') as profile:
            process_adapter = ScopedSubprocess(chrome, profile)
            converter.subprocess = process_adapter
            # The unchanged upstream API executes Pandoc, CJK preprocessing,
            # the chosen theme, Chrome, Poppler previews and its lint.
            result = converter.markdown_to_pdf(str(source), str(output / name), theme=theme, backend='chrome', previews=True)
            assert process_adapter.chrome_calls == 1, 'Expected actual upstream Chrome backend execution'
        path = Path(result)
        assert path == output / name and path.read_bytes().rstrip().endswith(b'%%EOF')
        observed.append({'id': variant, 'file': name, 'backend': 'chrome', 'base_theme': theme, 'override': overrides[variant].relative_to(ROOT).as_posix(), 'override_sha256': digest(overrides[variant]), 'bytes': path.stat().st_size, 'pdf_sha256': digest(path), 'upstream_api_executed': True, 'isolated_chrome_calls': process_adapter.chrome_calls})
    assert digest(UPSTREAM) == original_digest
    report = {'source': 'inputs/event.md', 'source_sha256': digest(source), 'upstream_converter_sha256': original_digest, 'backend': 'chrome', 'variants': observed, 'font': font_report, 'adapter': ['Append case-specific Japanese CSS after original theme/CJK patch', 'Create temporary static400/700/800 TrueType font instances from installed OFL Noto Sans JP; embed via transient data CSS to avoid Chrome Type3 variable-font output', 'Change generated HTML root language zh-CN to ja', 'Discover installed Chrome explicitly', 'Add disposable Chrome profile and Japanese locale only to its own subprocess', 'Read text subprocess output/input as UTF-8; explicit UTF-8 Poppler metadata/text and raw PDF dates'], 'verification': 'PDF creation is complete. Page images, extracted text, embedded fonts and visual layout require separate inspection. No tables in this source; table-border gate not applicable.'}
    (output / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'generated_requires_visual_review', 'outputs': [row['file'] for row in observed], 'report': str(output / 'build-report.json')}))


if __name__ == '__main__':
    main()
