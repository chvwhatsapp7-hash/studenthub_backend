import { pool } from "./database";

let admin;

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

export const sendNotificationToAll = async (title, message, role_ids = []) => {
  try {
    const firebase = await getFirebaseAdmin();

    if (!firebase) {
      console.log("⚠️ Firebase unavailable, skipping push");
      return;
    }

    let result;

    // ✅ Target selected roles
    if (Array.isArray(role_ids) && role_ids.length > 0) {
      result = await pool.query(
        `
        SELECT ud.token
        FROM "UserDevice" ud
        JOIN "User" u ON ud.user_id = u.user_id
        WHERE u.role_id = ANY($1::int[])
        `,
        [role_ids]
      );
    }

    // ✅ fallback = all except admin
    else {
      result = await pool.query(
        `
        SELECT ud.token
        FROM "UserDevice" ud
        JOIN "User" u ON ud.user_id = u.user_id
        WHERE u.role_id != 1
        `
      );
    }

    const tokens = result.rows.map(r => r.token).filter(Boolean);

    if (!tokens.length) {
      console.log("❌ No device tokens found");
      return;
    }

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
    console.error("🔥 Broadcast error:", err.message);
  }
};