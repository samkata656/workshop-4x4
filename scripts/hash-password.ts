/**
 * Prints the ADMIN_PASSWORD_HASH line for .env.
 *
 *   npm run admin:hash -- "your new password"
 */
import { hashPassword } from "../src/lib/admin/password";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Usage: npm run admin:hash -- "a password of at least 10 characters"');
  process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
