#!/usr/bin/env python3
"""Prepare and verify a GNOME Extensions upload without advancing the main checkout."""
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UUID = 'monitor-loupe@sprites.github.io'
ARTIFACT = f'{UUID}.shell-extension.zip'


def run(*args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)


def read_version(path):
    return json.loads(path.read_text())['version']


def clean_checkout():
    status = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True)
    if status.strip():
        raise SystemExit('Commit or stash all changes before preparing a release candidate.')


def archive_files(path):
    with zipfile.ZipFile(path) as archive:
        return {name: archive.read(name) for name in archive.namelist() if not name.endswith('/')}


def candidate():
    clean_checkout()
    current = read_version(ROOT / 'metadata.json')
    version = current + 1
    destination = ROOT / 'dist' / 'release-candidates' / f'v{version}'
    destination.mkdir(parents=True, exist_ok=True)
    output = destination / ARTIFACT
    with tempfile.TemporaryDirectory(prefix='monitor-loupe-release-') as temp:
        project = Path(temp) / 'project'
        shutil.copytree(ROOT, project, ignore=shutil.ignore_patterns('.git', 'dist', 'locale', 'gschemas.compiled', '*.zip'))
        metadata_path = project / 'metadata.json'
        metadata = json.loads(metadata_path.read_text())
        metadata['version'] = version
        metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
        run('make', 'pack', cwd=project)
        built = project / 'dist' / ARTIFACT
        if not built.is_file():
            raise SystemExit('GNOME pack did not produce the expected extension ZIP.')
        shutil.copy2(built, output)

    print(f'Upload this GNOME Extensions candidate: {output.relative_to(ROOT)} (version {version}).')
    print(f'Current repository and local installed version remains {current}.')
    print(f'After GNOME accepts it, run: make release-verify VERSION={version}')


def verify(version_text):
    try:
        version = int(version_text)
    except ValueError:
        raise SystemExit('VERSION must be a positive integer.')
    if version < 1:
        raise SystemExit('VERSION must be a positive integer.')
    current = read_version(ROOT / 'metadata.json')
    if current != version:
        raise SystemExit(f'metadata.json is version {current}; set it to accepted GNOME version {version} first.')
    candidate_path = ROOT / 'dist' / 'release-candidates' / f'v{version}' / ARTIFACT
    if not candidate_path.is_file():
        raise SystemExit(f'Missing prepared GNOME candidate: {candidate_path.relative_to(ROOT)}')

    run('make', 'pack')
    release_path = ROOT / 'dist' / ARTIFACT
    if archive_files(candidate_path) != archive_files(release_path):
        raise SystemExit('The source package differs from the accepted candidate. Rebuild and upload a new candidate.')
    print(f'Version {version} matches the GNOME candidate. {release_path.relative_to(ROOT)} is ready for GitHub Releases.')
    print('Commit the version update, push it, then attach this ZIP to the GitHub release.')


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == 'candidate':
        candidate()
    elif len(sys.argv) == 3 and sys.argv[1] == 'verify':
        verify(sys.argv[2])
    else:
        raise SystemExit('Usage: release.py candidate | release.py verify VERSION')
