import zipfile, shutil, os, re

SRC = 'sesame/Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
TMP = SRC + '.tmp'

shutil.copy(SRC, 'C:/tmp/beta_backup_prev11.docx')
z = zipfile.ZipFile(SRC)
doc = z.read('word/document.xml').decode('utf-8')

old = '<w:tab w:val="right" w:leader="dot" w:pos="10456"/>'
new = '<w:tab w:val="right" w:leader="dot" w:pos="9066"/>'
n = doc.count(old)
assert n == 78, n
doc = doc.replace(old, new)

with zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED) as out:
    for it in z.infolist():
        data = z.read(it.filename)
        if it.filename == 'word/document.xml':
            data = doc.encode('utf-8')
        out.writestr(it, data)
print('OK tabs fixed:', n)
