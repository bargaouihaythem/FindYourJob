const fs = require('fs');
const path = require('path');

const cvFiles = [
  '1_CV_Backend_Java_Spring_Thomas.pdf',
  '2_CV_Frontend_Angular_Sarah.pdf',
  '3_CV_Data_Science_IA_Youssef.pdf'
];

async function testAll() {
  for (const filename of cvFiles) {
    const filePath = path.join('cv_tests', filename);
    const pdfBytes = fs.readFileSync(filePath);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('cv', blob, filename);

    console.log(`\n======================================================`);
    console.log(`TEST DE : ${filename}`);
    console.log(`======================================================`);

    const response = await fetch('http://localhost:8080/api/matching/upload-cv', {
      method: 'POST',
      body: formData
    });

    if (response.status === 200) {
      const results = await response.json();
      console.log(`Statut HTTP : 200 OK | ${results.length} offres suggérées`);
      console.log(`Source : ${results[0]?.source || 'N/A'}`);
      console.log('Top 3 offres recommandées :');
      results.slice(0, 3).forEach((r, idx) => {
        console.log(`  ${idx + 1}. [${r.matchScore}%] ${r.title} (${r.location})`);
      });
    } else {
      console.error(`Erreur HTTP : ${response.status}`, await response.text());
    }
  }
}

testAll().catch(console.error);

