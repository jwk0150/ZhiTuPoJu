# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess

def load(label):
    if label == 'work':
        return Path('frontend/pages/resume.html').read_text(encoding='utf-8')
    ref = 'HEAD:frontend/pages/resume.html' if label == 'HEAD' else 'origin/jwk:frontend/pages/resume.html'
    return subprocess.check_output(['git', 'show', ref]).decode('utf-8', 'replace')

keys = [
    'NEXUS', '执图破局', '补充你的实践经历', '我有实习', '手动添加',
    '返回工作台', 'rb-left-head', 'rb-brandbar', '帮我生成'
]
for label in ('HEAD', 'jwk', 'work'):
    t = load(label)
    print('====', label, 'len', len(t), '====')
    for k in keys:
        print(f'  {k}: {t.count(k)}')
    i = t.find('data-step="3"')
    print('  step3 snippet:', repr(t[i:i+280]))
