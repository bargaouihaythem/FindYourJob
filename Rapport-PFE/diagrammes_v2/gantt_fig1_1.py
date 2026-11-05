# -*- coding: utf-8 -*-
"""Figure 1.1 — Diagramme de Gantt (mois reels, sans jours) du projet JOB4YOU.
Genere diagrammes_v2/fig1_1.png dans le style des autres figures (fond blanc, traits noirs).
Largeur physique volontairement proche de la largeur d'affichage dans le rapport
(453,3 pt) pour que le corps de reste lisible une fois reduit.
"""
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fig1_1.png')

MOIS = ['Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août']
# (phase, index du mois de debut, nombre de mois) — alignee sur le tableau 1.1
PHASES = [
    ('Prise en main\net cadrage', 0, 1),
    ('Analyse et\nconception', 1, 1),
    ('Développement —\nsocle applicatif', 2, 2),
    ('Développement —\nfonctionnalités avancées', 4, 2),
    ('Tests, corrections\net finalisation', 6, 1),
]

plt.rcParams.update({
    'font.family': 'Arial',
    'font.size': 9.5,
    'axes.edgecolor': '#000000',
    'text.color': '#000000',
    'xtick.color': '#000000',
    'ytick.color': '#000000',
})

n = len(PHASES)
fig, ax = plt.subplots(figsize=(7.0, 2.45), dpi=200)

for i, (label, start, span) in enumerate(PHASES):
    y = n - 1 - i
    ax.add_patch(Rectangle((start, y - 0.3), span, 0.6,
                           facecolor='#FFFFFF', edgecolor='#000000',
                           linewidth=1.2, zorder=3))

for x in range(len(MOIS) + 1):
    ax.plot([x, x], [-0.7, n - 0.3], color='#000000', linewidth=0.7,
            linestyle=(0, (3, 3)), zorder=1)

ax.set_xlim(0, len(MOIS))
ax.set_ylim(-0.7, n - 0.3)
ax.set_xticks([i + 0.5 for i in range(len(MOIS))])
ax.set_xticklabels(['%s 2026' % m if i == 0 else m for i, m in enumerate(MOIS)],
                   fontsize=9.5)
ax.set_yticks([n - 1 - i for i in range(n)])
ax.set_yticklabels([p[0] for p in PHASES], fontsize=9.5)
ax.tick_params(axis='both', length=0, pad=6)
for side in ('left', 'right', 'top'):
    ax.spines[side].set_visible(False)
ax.spines['bottom'].set_linewidth(1.1)
ax.xaxis.set_ticks_position('bottom')
ax.yaxis.set_ticks_position('left')

fig.subplots_adjust(left=0.29, right=0.995, top=0.90, bottom=0.16)
fig.savefig(OUT, facecolor='#FFFFFF')
print(OUT)
