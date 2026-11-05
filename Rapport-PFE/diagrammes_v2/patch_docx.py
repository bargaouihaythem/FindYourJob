# -*- coding: utf-8 -*-
import zipfile, shutil, re, struct, os, sys

SRC = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Bargaoui_Haythem_Corrige_New.docx'
DST = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNGDIR = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\diagrammes_v2\png'

# figure -> new png
FIG2MEDIA = {
    'image4.png':  'fig2_1.png',
    'image5.png':  'fig2_2.png',
    'image7.png':  'fig3_1.png',
    'image8.png':  'fig3_2.png',
    'image9.png':  'fig3_3.png',
    'image10.png': 'fig3_4.png',
    'image11.png': 'fig3_5.png',
    'image12.png': 'fig3_6.png',
    'image13.png': 'fig3_7.png',
    'image15.png': 'fig3_9.png',
    'image16.png': 'fig3_10.png',
    'image17.png': 'fig3_11.png',
}

def png_size(path):
    with open(path, 'rb') as f:
        data = f.read(33)
    w, h = struct.unpack('>II', data[16:24])
    return w, h

zin = zipfile.ZipFile(SRC)
rels = zin.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
relmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
# media filename -> rel id  (only for our targets)
media2rel = {}
for rid, tgt in relmap.items():
    base = tgt.split('/')[-1]
    if base in FIG2MEDIA:
        media2rel[base] = rid

xml = zin.read('word/document.xml').decode('utf-8', 'ignore')

# new aspect ratios and new bytes
newbytes = {}
aspect = {}   # rel id -> h/w
for media, rel in media2rel.items():
    png = os.path.join(PNGDIR, FIG2MEDIA[media])
    w, h = png_size(png)
    aspect[rel] = h / w
    with open(png, 'rb') as f:
        newbytes['word/media/' + media] = f.read()

# Adjust each v:shape that embeds a target image: fit inside original box, keep aspect.
def fix_shape(m):
    block = m.group(0)
    rm = re.search(r'<v:imagedata[^>]*r:id="([^"]+)"', block)
    if not rm:
        return block
    rel = rm.group(1)
    if rel not in aspect:
        return block
    sm = re.search(r'style="([^"]*)"', block)
    if not sm:
        return block
    style = sm.group(1)
    wm = re.search(r'width:\s*([\d.]+)pt', style)
    hm = re.search(r'height:\s*([\d.]+)pt', style)
    if not wm or not hm:
        return block
    ow, oh = float(wm.group(1)), float(hm.group(1))
    a = aspect[rel]
    w = ow
    h = w * a
    if h > oh:
        h = oh
        w = h / a
    newstyle = re.sub(r'width:\s*[\d.]+pt', 'width:%.2fpt' % w, style)
    newstyle = re.sub(r'height:\s*[\d.]+pt', 'height:%.2fpt' % h, newstyle)
    block = block.replace(sm.group(0), 'style="%s"' % newstyle)
    return block

xml = re.sub(r'<v:shape\b.*?</v:shape>', fix_shape, xml, flags=re.S)

# keepNext on figure image paragraphs so caption never orphans from its image
def fix_para(m):
    block = m.group(0)
    if 'v:imagedata' not in block:
        return block
    rm = re.search(r'<v:imagedata[^>]*r:id="([^"]+)"', block)
    if not rm or rm.group(1) not in aspect:
        return block
    if '<w:keepNext' in block:
        return block
    if '<w:pPr>' in block:
        block = block.replace('<w:pPr>', '<w:pPr><w:keepNext/>', 1)
    else:
        block = block.replace('<w:p ', '<w:p ><w:pPr><w:keepNext/></w:pPr>', 1) if block.startswith('<w:p ') else block
        if '<w:pPr>' not in block:
            block = re.sub(r'^(<w:p\b[^>]*>)', r'\1<w:pPr><w:keepNext/></w:pPr>', block, count=1)
    return block

xml = re.sub(r'<w:p\b[^>]*>.*?</w:p>', fix_para, xml, flags=re.S)

# write new zip
shutil.copyfile(SRC, DST)
import tempfile
tmp = DST + '.tmp'
zin = zipfile.ZipFile(SRC)
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = xml.encode('utf-8')
    elif item.filename in newbytes:
        data = newbytes[item.filename]
    zout.writestr(item, data)
zout.close()
zin.close()
os.replace(tmp, DST)
print('Wrote', DST)
print('replaced media:', sorted(newbytes.keys()))
