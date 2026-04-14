import pool from "./database"; // ✅ fix path if needed

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
export const sendNotification = async (user_id, title, message) => {
  try {

    // 🔥 Step 1: Get Firebase safely
    const firebase = await getFirebaseAdmin();
    if (!firebase) {
      console.log("⚠️ Firebase not initialized, skipping push");
      return;
    }

    // 🔍 Step 2: Fetch tokens
    const result = await pool.query(
      `SELECT token FROM "UserDevice" WHERE user_id = $1`,
      [user_id]
    );

    const tokens = result.rows.map(row => row.token).filter(Boolean);

    if (!tokens.length) {
      console.log("❌ No FCM tokens found for user:", user_id);
      return;
    }

    // 🔔 Step 3: Send push
    const response = await firebase.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: message,
      },
    });

    console.log(`✅ Push sent: ${response.successCount} success, ${response.failureCount} failed`);

    // 🔥 Step 4: Remove invalid tokens
    const invalidTokens = [];

    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;

        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await pool.query(
        `DELETE FROM "UserDevice" WHERE token = ANY($1)`,
        [invalidTokens]
      );

      console.log(`🧹 Removed ${invalidTokens.length} invalid tokens`);
    }

  } catch (err) {
    // 🔥 NEVER THROW — prevent API crash
    console.error("🔥 Push notification error:", err.message);
  }
};