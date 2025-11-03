import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

// ✅ Prevent duplicate initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

export { admin, db, auth, bucket };
