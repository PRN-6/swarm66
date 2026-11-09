const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') {
    const rootIndex = path.join(__dirname, '..', 'index.html');
    urlPath = fs.existsSync(rootIndex) ? '/index.html' : '/demo/index.html';
  }

  let filePath = path.join(__dirname, '..', urlPath);

  // Auto-resolve directories to index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

let port = Number(process.env.PORT) || 3000;

function startServer(p) {
  server.listen(p, () => {
    console.log(`\n⚡ dom-swarm multi-demo server running at:`);
    console.log(`   Demo  (SaaS Landing):         http://localhost:${p}/demo/index.html`);
    console.log(`   Demo1 (E-Commerce Store):     http://localhost:${p}/demo1/index.html`);
    console.log(`   Demo2 (Developer Docs):       http://localhost:${p}/demo2/index.html`);
    console.log(`   Demo3 (Creative Portfolio):   http://localhost:${p}/demo3/index.html`);
    console.log(`   Demo5 (Mega Showcase 200+ El):http://localhost:${p}/demo5/index.html\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    port++;
    server.listen(port);
  } else {
    console.error(err);
  }
});

startServer(port);

