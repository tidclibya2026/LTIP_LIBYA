"""Prepare reviewed local artifacts without staging, committing, or publishing."""
import hashlib, json, re, subprocess, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local-release-prep'
REPORT = ROOT / 'docs/reports/github-readiness'
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,})\b|(?i:password|api[_-]?key|client[_-]?secret)\s*[:=]\s*[\x22\x27][^\x22\x27\r\n]{12,}[\x22\x27]')
DENIED = re.compile(r'(^|[/_. -])(internal|hold|staging|backup|pending|secret|credentials)([/_. -]|$)', re.I)
def safe(path):
    p=Path(path)
    return not DENIED.search(p.as_posix()) and p.suffix.lower() not in {'.bak','.zip','.ppt','.pptx','.ps1','.ipynb','.pyc','.log'} and p.name not in {'.env','.npmrc'} and not p.name.startswith('.env.')
def check(path):
    data=(ROOT/path).read_bytes()
    if SECRET.search(data): raise ValueError('Potential credential; file excluded from preparation: '+path)
    if Path(path).suffix.lower() in {'.json','.geojson'}:
        value=json.loads(data.decode('utf-8-sig'))
        def visit(v):
            if isinstance(v,str) and re.search(r'(^|[_ -])(INTERNAL|HOLD)([_ -]|$)',v,re.I): raise ValueError('Restricted data value: '+path)
            if isinstance(v,dict):
                for k,x in v.items():
                    if k.lower() in {'classification','visibility','publication_clearance','status','approval_status'} and isinstance(x,str) and x.upper() in {'INTERNAL','HOLD'}: raise ValueError('Restricted data classification: '+path)
                    visit(x)
            elif isinstance(v,list):
                for x in v: visit(x)
        visit(value)
    return data
def digest(data): return hashlib.sha256(data).hexdigest()
def backup():
    LOCAL.mkdir(exist_ok=True)
    target=LOCAL/'safe-before-preparation.zip'
    if target.exists(): raise RuntimeError('Existing backup preserved; choose a new backup explicitly')
    changed=subprocess.check_output(['git','diff','--name-only','-z'],cwd=ROOT).decode().strip('\0').split('\0')
    untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=ROOT).decode().strip('\0').split('\0')
    selected=sorted({p for p in changed+untracked if p and safe(p) and (p in changed or p.startswith(('src/','public/','scripts/')) or (p.startswith('docs/') and Path(p).suffix.lower()=='.md')) and '.local-release-prep/' not in p})
    manifest={}; excluded=[]
    with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for p in selected:
            data=check(p)
            if re.search(rb'[A-Za-z]:[\\/](?:Users[\\/]|LTIP_)',data):
                excluded.append(p); continue
            z.writestr(p,data);manifest[p]=digest(data)
        z.writestr('BACKUP-SHA256.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    with zipfile.ZipFile(target) as z:
        assert all(digest(z.read(p))==h for p,h in manifest.items())
    (LOCAL/'backup-summary.json').write_text(json.dumps({'archive':target.name,'sha256':digest(target.read_bytes()),'verified_files':manifest,'excluded_private_paths':excluded,'scope':'selected modified/untracked source and public data; no staging, credentials, browser profiles or database exports'},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Verified safe backup:',len(manifest),'files; private-path files excluded:',len(excluded))
def package(prefix='21'):
    if not re.fullmatch(r'\d{2}',prefix): raise ValueError('Invalid report prefix')
    public=json.loads((ROOT/'release/public-files.json').read_text(encoding='utf-8'))
    paths=set(public)
    paths.update(p.relative_to(ROOT).as_posix() for p in (ROOT/'src').rglob('*') if p.is_file() and safe(p.relative_to(ROOT)))
    paths.update(['.gitignore','index.html','package.json','package-lock.json','vite.config.js','.github/workflows/deploy.yml','release/public-files.json','docs/reports/site-library-preservation.json','upgrade_print_v8.mjs'])
    paths.update(['release/parks-public-policy.json','scripts/parks-public-data.mjs','scripts/build-parks-public.mjs','scripts/test-parks-public.mjs','scripts/parks-public-browser-cases.mjs'])
    paths.update(['.gitattributes','release/text-preservation-eol.json','scripts/preservation-integrity.mjs','scripts/test-preservation-integrity.mjs'])
    test_files={'test-dashboard-browser.mjs','test-dashboard-merge.mjs','test-site-admin-browser.mjs','test-site-admin.mjs','test-site-editor-browser.mjs','test-site-library.mjs','prepare-release.py','merge-admin-package.mjs','merge-site-package.mjs','site-editor-browser-cases.mjs','test-evidence-forms-browser.mjs','evidence-form-browser-cases.mjs'}
    paths.update(p.relative_to(ROOT).as_posix() for p in (ROOT/'scripts').glob('*') if p.is_file() and (p.name.startswith('release-') or p.name in test_files))
    paths=sorted(paths)
    import datetime
    target=LOCAL/('candidate-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    if target.exists(): raise RuntimeError('Existing candidate preserved; prepare in a fresh directory')
    manifest=[]
    for p in paths:
        if not safe(p): raise ValueError('Disallowed release path: '+p)
        data=check(p); dest=target/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        role='public-runtime' if p.startswith('public/') else 'application' if p.startswith('src/') else 'verification' if p.startswith(('scripts/','docs/')) or p=='upgrade_print_v8.mjs' else 'build-and-ci'
        manifest.append({'path':p,'role':role,'sha256':digest(data),'bytes':len(data)})
    changed=set(subprocess.check_output(['git','diff','--name-only','-z'],cwd=ROOT).decode().strip('\0').split('\0'))
    untracked=set(subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=ROOT).decode().strip('\0').split('\0'))
    upload=[r for r in manifest if r['path'] in changed|untracked]
    (REPORT/f'{prefix}-release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORT/f'{prefix}-upload-allowlist.txt').write_text('\n'.join(r['path'] for r in upload)+'\n',encoding='utf-8')
    (REPORT/f'{prefix}-upload-allowlist.json').write_text(json.dumps(upload,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORT/f'{prefix}-local-exclusions.txt').write_text('\n'.join(sorted((changed|untracked)-set(paths)))+'\n',encoding='utf-8')
    (LOCAL/'current-candidate.txt').write_text(str(target),encoding='utf-8')
    print('Candidate files:',len(paths),'upload delta:',len(upload),'candidate:',target)
if __name__=='__main__':
    import sys
    {'backup':backup,'package':lambda:package(sys.argv[2] if len(sys.argv)>2 else '21')}[sys.argv[1]]()
