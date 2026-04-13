import admin from "./firebase";
import pool from "./db";

export const sendNotificationToAll = async (title, message) => {
  try {
    const result = await pool.query(`SELECT token FROM "UserDevice"`);

    const tokens = result.rows.map(r => r.token);

    if (!tokens.length) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: message,
      },
    });

    console.log("✅ Broadcast notification sent");

  } catch (err) {
    console.error("🔥 Broadcast error:", err);
  }
};