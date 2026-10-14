"""Run the exact production model with existing Claude Code authentication."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', type=Path, required=True)
    args = parser.parse_args()
    prompt = args.prompt.resolve().read_text('utf-8')
    executable = shutil.which('claude')
    if not executable:
        raise SystemExit('Claude Code is not installed. No fallback was executed.')
    model = json.loads((ROOT / 'data/projects.json').read_text('utf-8'))['production_model']
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    private = ROOT / '.local/runs' / timestamp
    private.mkdir(parents=True, exist_ok=False)
    command = [executable, '-p', '--model', model, '--effort', 'high', '--output-format', 'json', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep', '--tools', 'Read,Write,Edit,Glob,Grep', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-chrome', '--no-session-persistence']
    result = subprocess.run(command, input=prompt, capture_output=True, encoding='utf-8', cwd=ROOT)
    (private / 'result.json').write_text(result.stdout, 'utf-8')
    (private / 'stderr.txt').write_text(result.stderr, 'utf-8')
    (private / 'execution.json').write_text(json.dumps({'requested_model': model, 'exit_code': result.returncode, 'prompt_file': str(args.prompt), 'finished_at': datetime.now(timezone.utc).isoformat()}, indent=2) + '\n', 'utf-8')
    if result.returncode:
        raise SystemExit(f'Model run failed (exit {result.returncode}); details kept privately at {private}.')
    data = json.loads(result.stdout)
    if data.get('is_error'):
        raise SystemExit('Model returned an error. See the private execution record.')
    print(json.dumps({'requested_model': model, 'models_reported': list(data.get('modelUsage', {})), 'result': data.get('result', ''), 'record': str(private)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
