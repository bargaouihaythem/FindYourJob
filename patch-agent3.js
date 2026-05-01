const fs = require('fs');
const c = fs.readFileSync('fix-agent1.js', 'utf8');
const lines = c.split('\n');

// Find the old inline block: line 110 (comment) to line 176 (].join line)
const startLine = 110; // "// Même correctif pour Agent 3..."
let endLine = startLine;
for (let i = startLine; i < lines.length; i++) {
  if (lines[i].includes("].join('") && i > startLine) {
    endLine = i;
    break;
  }
}
console.log('Replacing lines', startLine, '-', endLine);
console.log('First line:', lines[startLine]);
console.log('Last line:', lines[endLine]);

// Remove lines startLine..endLine (inclusive), replace with single comment
lines.splice(startLine, endLine - startLine + 1,
  '// Agent 3 code loaded via require("./agent3-code.js") at top of file'
);

fs.writeFileSync('fix-agent1.js', lines.join('\n'), 'utf8');
console.log('Done. fix-agent1.js updated.');
