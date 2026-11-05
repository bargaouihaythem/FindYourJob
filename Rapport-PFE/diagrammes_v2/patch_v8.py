# -*- coding: utf-8 -*-
"""Replace the Fig 2.1 (activite) image (rId25 -> media/image17.png) with the redrawn PNG
and resize its VML shape to fill the landscape page. Writes to <docx>.tmp (manual mv)."""
import zipfile, re, os, sys, struct
import xml.etree.ElementTree as ET

DOCX = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\sesame\Rapport_PFE_Haythem_Bargaoui_version_beta.docx'
PNG = r'C:\Users\hbargaoui\OneDrive - Sopra Steria\Desktop\projetpfeee\FindYourJob\Rapport-PFE\diagrammes_v2\png\fig3_11.png'
MEDIA = 'word/media/image17.png'
W_MAX, H_MAX = 714.2, 470.0

zin = zipfile.ZipFile(DOCX)
xml = zin.read('word/document.xml').decode('utf-8')
png = open(PNG, 'rb').read()
w, h = struct.unpack('>II', png[16:24])
s = min(W_MAX / (w * 0.75), H_MAX / (h * 0.75))
W, H = w * 0.75 * s, h * 0.75 * s
print('png %dx%d -> %.1f x %.1f pt' % (w, h, W, H))

# locate the v:shape wrapping r:id="rId25"
i = xml.find('r:id="rId25"')
assert i > 0, 'rId25 introuvable'
ss = xml.rfind('<v:shape', 0, i)
se = xml.find('>', xml.find('style=', ss)) + 1
shape = xml[ss:se]
m = re.search(r'style="([^"]*)"', shape)
style = m.group(1)
new = re.sub(r'width:[\d.]+pt', 'width:%.1fpt' % W, style)
new = re.sub(r'height:[\d.]+pt', 'height:%.1fpt' % H, new)
xml2 = xml[:ss] + shape.replace('style="%s"' % style, 'style="%s"' % new) + xml[se:]
assert 'width:%.1fpt;height:%.1fpt' % (W, H) in xml2, 'style non applique'

ET.fromstring(xml2)  # well-formedness guard

tmp = DOCX + '.tmp'
zout = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename == 'word/document.xml':
        data = xml2.encode('utf-8')
    elif item.filename == MEDIA:
        data = png
    zout.writestr(item, data)
zout.close(); zin.close()
print('Wrote', tmp)
