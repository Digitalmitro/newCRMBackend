/**
 * Firebase Cloud Messaging (FCM) push notification utility.
 *
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Go to Project Settings → Service Accounts → Generate new private key
 * 3. Save the JSON as /home/claude/output/CRMBackend/config/firebase-service-account.json
 * 4. Set FIREBASE_PROJECT_ID in your .env file
 *
 * Until Firebase is configured, all push calls are no-ops (logged only).
 */

let admin = null;

const initFirebase = () => {
  if (admin) return admin;
  try {
    const firebaseAdmin = require("firebase-admin");
    const serviceAccountPath = require("path").join(__dirname, "../config/firebase-service-account.json");
    if (!require("fs").existsSync(serviceAccountPath)) {
      console.warn("[FCM] firebase-service-account.json not found — push notifications disabled.");
      return null;
    }
    const serviceAccount = require(serviceAccountPath);
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      });
    }
    admin = firebaseAdmin;
    return admin;
  } catch (err) {
    console.warn("[FCM] Firebase Admin SDK not installed — run: npm install firebase-admin");
    return null;
  }
};

/**
 * Send push notification to a single FCM token.
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body  - Notification body
 * @param {object} data  - Extra key-value data payload (all values must be strings)
 */
const sendPush = async (token, title, body, data = {}) => {
  if (!token) return;
  const firebase = initFirebase();
  if (!firebase) {
    console.log(`[FCM] Would send: "${title}" → ${token.slice(0, 20)}...`);
    return;
  }
  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: "high" },
      apns: { headers: { "apns-priority": "10" } },
    };
    const response = await firebase.messaging().send(message);
    console.log(`[FCM] Sent: ${response}`);
  } catch (err) {
    if (err.code === "messaging/registration-token-not-registered") {
      console.warn(`[FCM] Stale token, should be removed: ${token.slice(0, 20)}...`);
    } else {
      console.error("[FCM] Error:", err.message);
    }
  }
};

/**
 * Send push to multiple tokens at once.
 */
const sendPushMultiple = async (tokens, title, body, data = {}) => {
  const valid = (tokens || []).filter(Boolean);
  if (!valid.length) return;
  await Promise.allSettled(valid.map((t) => sendPush(t, title, body, data)));
};

module.exports = { sendPush, sendPushMultiple };
