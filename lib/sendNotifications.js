import admin from "./firebase";
import pool from "./db";

export const sendNotification = async (user_id, title, message) => {
  try {

    // 🔍 Get all user tokens
    const result = await pool.query(
      `SELECT token FROM "UserDevice" WHERE user_id = $1`,
      [user_id]
    );

    const tokens = result.rows.map(row => row.token);

    if (!tokens.length) {
      console.log("❌ No FCM tokens found for user");
      return;
    }

    // 🔔 Send to multiple devices
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: message,
      },
    });

    console.log("✅ Push sent:", response.successCount, "success");

    // ⚠️ Optional: remove invalid tokens
    const invalidTokens = [];

    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        const error = resp.error?.code;

        if (
          error === "messaging/invalid-registration-token" ||
          error === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    // 🧹 Clean invalid tokens
    if (invalidTokens.length > 0) {
      await pool.query(
        `DELETE FROM "UserDevice" WHERE token = ANY($1)`,
        [invalidTokens]
      );

      console.log("🧹 Removed invalid tokens:", invalidTokens.length);
    }

  } catch (err) {
    console.error("🔥 Push notification error:", err);
  }
};