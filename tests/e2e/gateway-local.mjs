// Gateway local: imita o Kong do Supabase (/auth/v1 -> GoTrue, /rest/v1 -> PostgREST),
// serve os modelos de e-mail e guarda os e-mails recebidos por um SMTP mínimo.
import http from "node:http";
import net from "node:net";

const mails = [];
const templates = {
  invite: `<h2>Convite</h2><p>Você foi convidado(a) para a plataforma de onboarding.</p><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/definir-senha">Aceitar convite e criar senha</a></p>`,
  recovery: `<h2>Nova senha</h2><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/definir-senha">Criar nova senha</a></p>`,
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/templates/")) {
    res.setHeader("content-type", "text/html");
    return res.end(templates[url.pathname.split("/")[2]] ?? "");
  }
  if (url.pathname === "/__reset") { mails.length = 0; return res.end("ok"); }
  const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
  if (url.pathname.startsWith("/storage/") && req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (url.pathname.startsWith("/storage/v1/object/public/branding/")) {
    const f = "/var/tmp/sbstack/branding/" + url.pathname.split("/branding/")[1];
    const type = f.endsWith(".png") ? "image/png" : f.endsWith(".jpg") ? "image/jpeg" : "image/webp";
    try { const b = (await import("node:fs")).readFileSync(f); res.writeHead(200, { "content-type": type, ...CORS }); return res.end(b); }
    catch { res.writeHead(404, CORS); return res.end(); }
  }
  // Upload mínimo no bucket "branding" (sem checar permissão: só para testes locais).
  if (url.pathname.startsWith("/storage/v1/object/branding/") && (req.method === "POST" || req.method === "PUT")) {
    const fs = await import("node:fs");
    const rel = url.pathname.split("/object/branding/")[1];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    fs.mkdirSync("/var/tmp/sbstack/branding/" + rel.split("/").slice(0, -1).join("/"), { recursive: true });
    let body = Buffer.concat(chunks);
    const m = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "");
    if (m) {
      // multipart: pega a maior parte (o arquivo; as outras são campos como cacheControl).
      const sep = Buffer.from("--" + m[1]);
      let best = Buffer.alloc(0);
      let pos = body.indexOf(sep);
      while (pos >= 0) {
        const next = body.indexOf(sep, pos + sep.length);
        if (next < 0) break;
        const part = body.subarray(pos + sep.length, next);
        const h = part.indexOf("\r\n\r\n");
        const content = part.subarray(h + 4, part.length - 2);
        if (h >= 0 && content.length > best.length) best = content;
        pos = next;
      }
      body = best;
    }
    fs.writeFileSync("/var/tmp/sbstack/branding/" + rel, body);
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ Key: "branding/" + rel, Id: rel }));
  }
  if (url.pathname === "/storage/v1/object/branding" && req.method === "DELETE") {
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end("[]");
  }
  if (url.pathname === "/__mails") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(mails));
  }
  let target;
  if (url.pathname.startsWith("/auth/v1")) target = { port: 9999, path: req.url.replace(/^\/auth\/v1/, "") || "/" };
  else if (url.pathname.startsWith("/rest/v1")) target = { port: 3001, path: req.url.replace(/^\/rest\/v1/, "") || "/" };
  else { res.statusCode = 404; return res.end("not found"); }
  const p = http.request({ host: "127.0.0.1", port: target.port, path: target.path, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  p.on("error", (e) => { res.statusCode = 502; res.end(String(e)); });
  req.pipe(p);
}).listen(54321, () => console.log("gateway :54321"));

net.createServer((sock) => {
  let data = "", inData = false, msg = { to: [], body: "" };
  const say = (s) => sock.write(s + "\r\n");
  say("220 localhost ESMTP sink");
  sock.on("data", (chunk) => {
    data += chunk.toString("utf8");
    let idx;
    while (true) {
      if (inData) {
        idx = data.indexOf("\r\n.\r\n");
        if (idx < 0) return;
        msg.body = data.slice(0, idx); data = data.slice(idx + 5); inData = false;
        mails.push({ ...msg, at: new Date().toISOString() }); msg = { to: [], body: "" };
        say("250 OK queued");
        continue;
      }
      idx = data.indexOf("\r\n");
      if (idx < 0) return;
      const line = data.slice(0, idx); data = data.slice(idx + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") { sock.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n"); }
      else if (cmd === "AUTH") say("235 OK");
      else if (cmd === "MAIL") say("250 OK");
      else if (cmd === "RCPT") { msg.to.push(line.replace(/^RCPT TO:\s*<?([^>]*)>?.*/i, "$1")); say("250 OK"); }
      else if (cmd === "DATA") { inData = true; say("354 go"); }
      else if (cmd === "QUIT") { say("221 bye"); sock.end(); return; }
      else say("250 OK");
    }
  });
}).listen(2525, () => console.log("smtp :2525"));
