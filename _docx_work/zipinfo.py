# -*- coding: utf-8 -*-
import zipfile, re, sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

p = r'D:\Learning_test\backup3\ZhiTuPoJu\_docx_work\source.docx'
z = zipfile.ZipFile(p)
names = z.namelist()
print('=== ZIP ENTRIES ===')
for n in names:
    print(n)

print('\n=== app.xml ===')
try:
    print(z.read('docProps/app.xml').decode('utf-8', 'replace'))
except Exception as e:
    print('err', e)

print('\n=== core.xml ===')
try:
    print(z.read('docProps/core.xml').decode('utf-8', 'replace'))
except Exception as e:
    print('err', e)

# count media
media = [n for n in names if n.startswith('word/media/')]
print('\nmedia count:', len(media))

# document.xml stats
doc = z.read('word/document.xml').decode('utf-8', 'replace')
print('document.xml length:', len(doc))
print('paragraph count <w:p ', doc.count('<w:p '), doc.count('<w:p>'))
print('table count <w:tbl', doc.count('<w:tbl'))
print('row count <w:tr', doc.count('<w:tr'))
print('drawing count <w:drawing', doc.count('<w:drawing'))
print('pict count <w:pict', doc.count('<w:pict'))
print('object count <w:object', doc.count('<w:object'))
