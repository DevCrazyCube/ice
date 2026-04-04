import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { SignJWT } from "jose";

dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

const secret = process.env["SESSION_SECRET"];
if (!secret || secret.length < 32) {
  console.error("SESSION_SECRET must be set (min 32 chars) in root .env");
  process.exit(1);
}

const key = new TextEncoder().encode(secret);

const token = await new SignJWT({
  org: "a0000000-0000-0000-0000-000000000001",
  roles: ["org_admin"],
  email: "admin@seed-corp.local",
})
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("b0000000-0000-0000-0000-000000000001")
  .setIssuer("ice-api")
  .setAudience("ice-api")
  .setIssuedAt()
  .setExpirationTime("8h")
  .sign(key);

console.log(token);
