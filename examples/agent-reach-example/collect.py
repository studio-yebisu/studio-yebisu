"""Reproduce the bounded, read-only collection into a NEW private directory.

Python 3.10+, Agent Reach's runtime dependencies, gh and twitter-cli 0.8.5 are
required. Existing explicit login configuration is reused. No installation,
login, browser-cookie extraction, post, comment or other write API is executed.
Raw results are private and must never be copied into the public example.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, base64, hashlib, importlib.metadata, json, os, subprocess, sys

SITE = Path(__file__).resolve().parent
FIXED = '94f06c1969dfc1834001269d79d3ad0972d9dee6'
REPOSITORY = 'Panniantong/Agent-Reach'
POST = '2110111219172712922'
VENDOR = SITE / 'vendor/agent-reach'
SOURCES = ['README.md', 'LICENSE', 'agent_reach/skill/SKILL.md',
           'agent_reach/skill/references/dev.md',
           'agent_reach/skill/references/social.md', 'agent_reach/channels/twitter.py']

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--private-out', type=Path, required=True,
                   help='NEW private output directory, outside public examples/media/data/dist')
    a = p.parse_args()
    dest = a.private_out.resolve()
    project = SITE.parent.parent
    protected = [SITE, project / 'examples', project / 'media', project / 'data', project / 'dist']
    if any(dest.is_relative_to(path.resolve()) for path in protected):
        p.error('Raw collection must be kept outside public artifact directories.')
    dest.mkdir(parents=True, exist_ok=False)
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    write = lambda name, data: (dest/name).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    env = os.environ.copy()
    env.update(PYTHONPATH=str(VENDOR), PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1',
               GH_NO_UPDATE_NOTIFIER='1', GH_NO_EXTENSION_UPDATE_NOTIFIER='1',
               GH_TELEMETRY='false', DO_NOT_TRACK='true')
    records = []

    def run(name, args, child_env=env):
        start = datetime.now(timezone.utc).isoformat()
        result = subprocess.run(args, env=child_env, capture_output=True, timeout=100)
        (dest/(name+'.stdout')).write_bytes(result.stdout)
        (dest/(name+'.stderr')).write_bytes(result.stderr)
        record = {'step': name, 'started_at': start,
                  'finished_at': datetime.now(timezone.utc).isoformat(),
                  'exit_code': result.returncode, 'stdout_sha256': sha(result.stdout),
                  'stderr_sha256': sha(result.stderr)}
        records.append(record)
        write('commands.json', records)
        if result.returncode:
            raise RuntimeError(name+' failed; see private output. No alternative login was attempted.')
        return json.loads(result.stdout.decode('utf-8-sig'))

    doctor = run('doctor', [sys.executable, '-m', 'agent_reach.cli', 'doctor', '--json'])
    repository = run('repository', ['gh', 'api', 'repos/'+REPOSITORY])
    assert not repository['private'] and repository['full_name'].lower() == REPOSITORY.lower()
    commit = run('commit', ['gh', 'api', 'repos/'+REPOSITORY+'/commits/'+FIXED])
    assert commit['sha'] == FIXED
    for i, name in enumerate(SOURCES):
        source = run('source-'+str(i+1), ['gh', 'api', 'repos/'+REPOSITORY+'/contents/'+name+'?ref='+FIXED])
        assert sha(base64.b64decode(source['content'])) == sha((VENDOR/name).read_bytes())

    sys.path.insert(0, str(VENDOR))
    from agent_reach.config import Config
    from agent_reach.channels.twitter import twitter_cli_child_env
    config = Config(read_only=True)
    child_env = env.copy()
    child_env.update(twitter_cli_child_env(config))
    if not all(child_env.get(key) for key in ['TWITTER_AUTH_TOKEN', 'TWITTER_CT0']):
        raise RuntimeError('Existing explicit X credentials are absent. X collection stopped without browser reading or login.')
    # Keep the original CLI and authentication verification; suppress only its
    # automatic browser-cookie fallback if the explicit credentials fail.
    guard = ('import twitter_cli.auth as a\n'
             'def blocked():\n'
             '    return None,["Automatic browser-cookie reading disabled for this example"]\n'
             'a.extract_from_browser=blocked\n'
             'from twitter_cli.cli import cli\n'
             'cli.main(args=["tweet","'+POST+'","-n","1","--json"],prog_name="twitter")\n')
    post = run('post', [sys.executable, '-c', guard], child_env)
    assert post['ok'] is True
    matches = [item for item in post['data'] if item.get('id') == POST and item.get('text', '').strip()]
    assert len(matches) == 1
    summary = {'source_commit': FIXED, 'github_source_files_matched': len(SOURCES),
               'doctor': {key: {'status': doctor[key]['status'],
                                'active_backend': doctor[key]['active_backend']}
                          for key in ['github', 'twitter']},
               'post_id': POST, 'target_body_present': True,
               'twitter_cli_version': importlib.metadata.version('twitter-cli'),
               'automatic_browser_cookie_fallback_disabled': True,
               'config_read_only': True, 'raw_outputs_private': True,
               'human_approval': False}
    write('summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False))

if __name__ == '__main__':
    main()
