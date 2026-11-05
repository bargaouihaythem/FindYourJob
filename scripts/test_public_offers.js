const http = require('http');

http.get('http://localhost:8080/api/job-offers/public?page=0&size=10', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    const json = JSON.parse(data);
    console.log('Nombre d\'offres retournees :', json.length);
    json.forEach(o => {
      console.log(`- ID ${o.id}: "${o.title}" | Statut: ${o.status} | Contrat: ${o.contractType} | Lieu: ${o.location}`);
    });
  });
}).on('error', err => {
  console.error('Erreur:', err.message);
});

