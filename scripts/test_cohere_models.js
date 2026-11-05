const https = require('https');
const key = '8f5yjDb8heLShRClzv8MRQHEYDgEeYGqaDC23VMN';

for (const model of ['command-a-03-2025', 'command-r-08-2024', 'command-r-plus-08-2024']) {
  const data = JSON.stringify({
    model: model,
    messages: [{ role: 'user', content: 'Reply with JSON: {"status": "ok"}' }],
    response_format: { type: 'json_object' }
  });

  const req = https.request({
    hostname: 'api.cohere.com',
    path: '/v2/chat',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log(`Model ${model}: Status ${res.statusCode}`);
      if (res.statusCode !== 200) console.log(body);
    });
  });
  req.on('error', e => console.error(model, e.message));
  req.write(data);
  req.end();
}

