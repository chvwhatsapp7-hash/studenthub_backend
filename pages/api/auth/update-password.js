import bcrypt from "bcrypt";
import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    // ─────────────────────────────────────────
    // PATCH/POST — Update user password by email
    // ─────────────────────────────────────────
    if (req.method === "PATCH" || req.method === "POST") {
      const { email, password } = req.body;

      // Required field check
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "email and password are required"
        });
      }

      // Check if email exists
      const userCheck = await pool.query(
        `SELECT user_id FROM "User" WHERE email = $1`,
        [email]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Email not found"
        });
      }

      // Hash new password (same as registration)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and timestamp
      const result = await pool.query(
        `UPDATE "User" 
         SET password_hash = $1, updated_at = NOW()
         WHERE email = $2
         RETURNING user_id, email, updated_at`,
        [hashedPassword, email]
      );

      return res.status(200).json({
        success: true,
        message: "Password updated successfully",
        data: {
          user_id: result.rows[0].user_id,
          email: result.rows[0].email
        }
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error("Update password error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error"
    });
  }
}
