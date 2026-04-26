import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = req.query.user_id || user.user_id;
  const { category } = req.query;

  try {

    if (req.method === "GET") {

      let query = `
        SELECT
          notification_id,
          title,
          message,
          type,
          entity_id,
          redirect_url,
          is_read,
          created_at
        FROM "Notification"
        WHERE user_id = $1
      `;

      const params = [user_id];

      // ✅ personal only
      if (category === "personal") {
        query += `
          AND type IN ('enrollment','application','achievement','saved')
        `;
      }

      // ✅ public only
      else if (category === "public") {
        query += `
          AND type IN ('course','job','internship','hackathon','company')
        `;
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);

      return res.status(200).json({
        success: true,
        unread_count: result.rows.filter(n => !n.is_read).length,
        data: result.rows
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}