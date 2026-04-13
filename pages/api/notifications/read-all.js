import pool from "../../../lib/db";
import { authenticate } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false });

  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await pool.query(
    `UPDATE "Notification"
     SET is_read = true
     WHERE user_id = $1`,
    [user.user_id]
  );

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read"
  });
}