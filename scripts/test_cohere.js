const https = require('https');
const key = '8f5yjDb8heLShRClzv8MRQHEYDgEeYGqaDC23VMN';
const data = JSON.stringify({
  model: 'command-r-plus-08-2024',
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
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();

