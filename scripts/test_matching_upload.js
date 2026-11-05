const fs = require('fs');

async function testUpload() {
  const pdfBytes = fs.readFileSync('sample_cv_test.pdf');
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('cv', blob, 'sample_cv_test.pdf');

  console.log('Envoi du CV réel PDF à http://localhost:8080/api/matching/upload-cv ...');
  const response = await fetch('http://localhost:8080/api/matching/upload-cv', {
    method: 'POST',
    body: formData
  });

  console.log('HTTP Status:', response.status);
  const json = await response.json();
  if (Array.isArray(json)) {
    console.log(`Nombre d'offres suggérées : ${json.length}`);
    console.table(json.slice(0, 5).map(o => ({
      id: o.jobOfferId,
      titre: o.title,
      score: o.matchScore + '%',
      source: o.source,
      lieu: o.location
    })));
    if (json.length > 0) {
      console.log(`\nSource du premier résultat : "${json[0].source}"`);
      if (json[0].source === 'COHERE') {
        console.log('>>> SUCCÈS CONFIRMÉ : L\'API Cohere IA est active et fonctionne en production locale ! <<<');
      } else {
        console.log('>>> Fallback mots-clés utilisé <<<');
      }
    }
  } else {
    console.log('Réponse non tableau:', json);
  }
}

testUpload().catch(console.error);

