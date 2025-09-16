const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>🌊 Diving Social App</title></head>
      <body style="font-family: Arial; text-align: center; margin-top: 100px;">
        <h1>🌊 Diving Social App Frontend</h1>
        <p>Frontend is running on port ${PORT}!</p>
        <p>Backend API: <a href="http://localhost:8000">http://localhost:8000</a></p>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Frontend server is running on port ${PORT}`);
});