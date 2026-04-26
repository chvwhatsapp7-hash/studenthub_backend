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

  const selected_user_id = req.query.user_id || user.user_id;
  const { category } = req.query;

  try {

    if (req.method === "GET") {

      let query = `
        SELECT
          notification_id,
          title,
          message,
          type,
          category,
          entity_id,
          redirect_url,
          is_read,
          created_at
        FROM "Notification"
        WHERE user_id = $1
      `;

      const params = [selected_user_id];

      // ✅ FILTER USING CATEGORY COLUMN
      if (category === "public" || category === "personal") {
        query += ` AND category = $2`;
        params.push(category.toLowerCase());
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);

      const unreadCount = result.rows.filter(n => !n.is_read).length;

      return res.status(200).json({
        success: true,
        unread_count: unreadCount,
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