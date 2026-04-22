import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotification } from "../../lib/sendNotifications"; // optional

export default async function handler(req, res) {

  // ✅ CORS
  if (cors(req, res)) return;

  // ✅ AUTH
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = user.user_id;

  try {

    // =========================================================
    // GET — Fetch user achievements
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT
          a.achievement_id,
          a.title,
          a.description,
          a.icon,
          ua.achieved_at
        FROM "UserAchievement" ua
        JOIN "Achievement" a 
          ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = $1
        ORDER BY ua.achieved_at DESC
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Add achievement + Notification
    // =========================================================
    if (req.method === "POST") {

      const { achievement_id } = req.body;

      if (!achievement_id) {
        return res.status(400).json({
          success: false,
          message: "achievement_id is required"
        });
      }

      // 🔍 Check valid achievement
      const checkAchievement = await pool.query(
        `SELECT title FROM "Achievement" WHERE achievement_id = $1`,
        [achievement_id]
      );

      if (checkAchievement.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid achievement_id"
        });
      }

      const achievementTitle = checkAchievement.rows[0].title;

      // 🔍 Check duplicate
      const checkUser = await pool.query(
        `
        SELECT 1 FROM "UserAchievement"
        WHERE user_id = $1 AND achievement_id = $2
        `,
        [user_id, achievement_id]
      );

      if (checkUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Achievement already earned"
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 🔹 Insert achievement
        const result = await client.query(
          `
          INSERT INTO "UserAchievement"
          (user_id, achievement_id, achieved_at)
          VALUES ($1, $2, NOW())
          RETURNING *
          `,
          [user_id, achievement_id]
        );

        // ======================================================
        // 🔔 STORE NOTIFICATION
        // ======================================================
        const title = "Achievement Unlocked 🎉";
        const message = `You earned: ${achievementTitle}`;

        await client.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, is_read, created_at)
          VALUES ($1, $2, $3, 'achievement', $4, false, NOW())
          `,
          [user_id, title, message, achievement_id]
        );

        await client.query("COMMIT");
        client.release();

        // ======================================================
        // 🔥 PUSH NOTIFICATION (SAFE)
        // ======================================================
        try {
          await sendNotification(user_id, title, message);
        } catch (err) {
          console.error("❌ Push failed:", err.message);
        }

        return res.status(201).json({
          success: true,
          message: "Achievement added successfully",
          data: result.rows[0]
        });

      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("ACHIEVEMENT API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}