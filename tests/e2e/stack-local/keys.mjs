import crypto from "node:crypto";
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(payload);
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", exp })}`);
console.log(`SERVICE_KEY=${sign({ role: "service_role", iss: "supabase", exp })}`);
