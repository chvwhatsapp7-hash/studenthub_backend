import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    // ✅ Save token (avoid duplicates)
    await pool.query(
      `
      INSERT INTO "UserDevice" (user_id, token)
      VALUES ($1, $2)
      ON CONFLICT (user_id, token) DO NOTHING
      `,
      [user.user_id, token]
    );

    return res.status(200).json({
      success: true,
      message: "Token saved successfully"
    });

  } catch (err) {
    console.error("TOKEN API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}