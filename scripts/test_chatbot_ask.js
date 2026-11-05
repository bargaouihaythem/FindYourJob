async function testChatbot() {
  console.log('1. Connexion en tant que candidat...');
  const loginRes = await fetch('http://localhost:8080/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'candidat', password: 'password123' })
  });

  if (!loginRes.ok) {
    console.error('Erreur login:', loginRes.status, await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Connecté avec succès ! Token reçu.');

  console.log('\n2. Test de l\'accueil du chatbot (/api/chatbot/greeting)...');
  const greetingRes = await fetch('http://localhost:8080/api/chatbot/greeting', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Greeting Status:', greetingRes.status);
  console.log('Greeting Body:', await greetingRes.json());

  console.log('\n3. Test d\'une question au chatbot (/api/chatbot/ask)...');
  const askRes = await fetch('http://localhost:8080/api/chatbot/ask', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Bonjour, comment fonctionne la fonctionnalité Job idéal ?' })
  });

  console.log('Ask Status:', askRes.status);
  const askData = await askRes.json();
  console.log('\n>>> RÉPONSE DU CHATBOT JOB4YOU :');
  console.log(askData.answer || askData);
}

testChatbot().catch(console.error);
