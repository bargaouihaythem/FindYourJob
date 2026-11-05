import docx

doc = docx.Document('Rapport-PFE/Rapport_PFE_Bargaoui_Haythem_Corrige_New.docx')
with open('Rapport-PFE/all_tables.txt', 'w', encoding='utf-8') as f:
    for i, t in enumerate(doc.tables):
        f.write(f"\n=== Table {i} ({len(t.rows)} rows) ===\n")
        for row in t.rows:
            f.write(' | '.join([c.text.strip().replace('\n', ' ') for c in row.cells]) + "\n")
print("Saved all tables to Rapport-PFE/all_tables.txt")

