/**
 * Prints a VAPID key pair for web push (§19.6). Paste into .env.local / Vercel:
 *   pnpm tsx scripts/generate-vapid.ts
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@ejarikw.com`);
