// Servidor falso do Resend para os testes: guarda cada envio em /var/tmp/sbstack/resend.jsonl.
import http from "node:http";
import fs from "node:fs";
const out = "/var/tmp/sbstack/resend.jsonl";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body || "{}");
    if (req.headers.authorization !== "Bearer re_teste") { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ message: "API key is invalid" })); }
    if ((j.to?.[0] ?? "").startsWith("falha")) { res.writeHead(422, { "content-type": "application/json" }); return res.end(JSON.stringify({ message: "Endereço recusado" })); }
    fs.appendFileSync(out, JSON.stringify({ to: j.to, subject: j.subject, from: j.from, key: req.headers["idempotency-key"], html: j.html.length, htmlHas: j.html.slice(0, 20000), hasCta: j.html.includes("http://localhost:3000/") }) + "\n");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "fake-" + Date.now() }));
  });
}).listen(54398);
