// Gateway local: imita o Kong do Supabase (/auth/v1 -> GoTrue, /rest/v1 -> PostgREST),
// serve os modelos de e-mail e guarda os e-mails recebidos por um SMTP mínimo.
import http from "node:http";
import net from "node:net";

const mails = [];
const templates = {
  invite: `<h2>Convite</h2><p>Você foi convidado(a) para a plataforma de onboarding.</p><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/definir-senha">Aceitar convite e criar senha</a></p>`,
  recovery: `<h2>Nova senha</h2><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/definir-senha">Criar nova senha</a></p>`,
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/templates/")) {
    res.setHeader("content-type", "text/html");
    return res.end(templates[url.pathname.split("/")[2]] ?? "");
  }
  if (url.pathname === "/__reset") { mails.length = 0; return res.end("ok"); }
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
