const https = require('https');
const GROQ = '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';

async function main() {
  const cvContent = 'Thomas Martin Spring Boot Java Docker Kubernetes microservices REST agile scrum git Senior 5ans';
  const offreTitre = 'Developpeur Backend Java Spring Boot';
  
  const prompt = 'Tu es un expert RH. Analyse ce CV pour le poste "' + offreTitre + '".\n\nCV:\n' + cvContent + '\n\nReponds UNIQUEMENT en JSON valide:\n{"score": 75, "summary": "2 phrases.", "recommendation": "HIRE"}';
  
  const body = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'Expert RH. Reponds UNIQUEMENT en JSON valide.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 300
  });
  
  const result = await new Promise(function(res) {
    const o = {
      hostname: 'api.groq.com', port: 443,
      path: '/openai/v1/chat/completions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const r = https.request(o, function(resp) {
      let raw = '';
      resp.on('data', function(c) { raw += c; });
      resp.on('end', function() { res(JSON.parse(raw)); });
    });
    r.on('error', function(e) { res({ error: e.message }); });
    r.write(body);
    r.end();
  });
  
  const content = result.choices[0].message.content.trim();
  console.log('=== Reponse Groq brute ===');
  console.log(content);
  console.log('');
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('=== Parsed ===');
    console.log('score=' + parsed.score);
    console.log('summary=' + parsed.summary);
    console.log('recommendation=' + parsed.recommendation);
  } else {
    console.log('Pas de JSON trouve dans la reponse!');
  }
}

main().catch(function(e) { console.error('Erreur:', e.message); });
