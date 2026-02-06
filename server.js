const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3000;
const publicDir = __dirname;

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const serveFile = (filePath, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const requestUrl = req.url.split("?")[0];
  const safePath = requestUrl === "/" ? "/index.html" : requestUrl;
  const filePath = path.join(publicDir, safePath);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(filePath, res);
      return;
    }

    const indexPath = path.join(publicDir, "index.html");
    serveFile(indexPath, res);
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
