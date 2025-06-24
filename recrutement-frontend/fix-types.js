// Correction automatique des types any dans interviews.component.ts
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/pages/admin/interviews/interviews.component.ts';
let content = readFileSync(filePath, 'utf8');

// Remplacer tous les "error: (error) =>" par "error: (error: any) =>"
content = content.replace(/error: \(error\) =>/g, 'error: (error: any) =>');

writeFileSync(filePath, content, 'utf8');
console.log('Fichier corrigé avec succès!');
