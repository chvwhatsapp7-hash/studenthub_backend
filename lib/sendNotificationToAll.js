import pool from "./database"; // ✅ make sure this path is correct

let admin; // 🔥 lazy load

// ✅ SAFE FIREBASE INITIALIZATION
const getFirebaseAdmin = async () => {
  try {
    if (!admin) {
      const mod = await import("firebase-admin");
      admin = mod.default;

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          }),
        });
      }
    }

    return admin;
  } catch (err) {
    console.error("🔥 Firebase init failed:", err.message);
    return null;
  }
};

// ✅ MAIN FUNCTION
export const sendNotificationToAll = async (title, message) => {
  try {
    const firebase = await getFirebaseAdmin();

    // 🔴 If Firebase fails → DO NOT CRASH
    if (!firebase) {
      console.log("⚠️ Firebase unavailable, skipping push");
      return;
    }

    // 🔍 Get tokens
    const result = await pool.query(`SELECT token FROM "UserDevice"`);

    const tokens = result.rows.map(r => r.token).filter(Boolean);

    if (!tokens.length) {
      console.log("❌ No device tokens found");
      return;
    }

    // 🔔 Send push (max 500 per batch)
    const batchTokens = tokens.slice(0, 500);

    const response = await firebase.messaging().sendEachForMulticast({
      tokens: batchTokens,
      notification: {
        title,
        body: message,
      },
    });

    console.log(
      `✅ Broadcast sent: ${response.successCount} success, ${response.failureCount} failed`
    );

  } catch (err) {
    // 🔥 NEVER THROW — prevents API crash
    console.error("🔥 Broadcast error:", err.message);
  }
};