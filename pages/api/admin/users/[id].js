import pool from "../../../../lib/db";
import { cors } from "../../../../lib/cors";
import { authenticate } from "../../../../lib/auth";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const admin = authenticate(req, res);
  if (!admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.method === "PATCH") {
    try {
      const { id } = req.query;
      const { status, role_id } = req.body;
      
      const user_id = parseInt(id, 10);
      if (isNaN(user_id)) {
        return res.status(400).json({ success: false, message: "Invalid user_id" });
      }

      // Build dynamic update query
      let updateFields = [];
      let values = [];
      let index = 1;

      if (status !== undefined) {
        updateFields.push(`status = $${index++}`);
        values.push(status);
      }

      if (role_id !== undefined) {
        updateFields.push(`role_id = $${index++}`);
        values.push(role_id);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ success: false, message: "No fields to update" });
      }

      values.push(user_id);
      
      const query = `
        UPDATE "User"
        SET ${updateFields.join(", ")}, updated_at = NOW()
        WHERE user_id = $${index}
        RETURNING user_id, status, role_id
      `;

      const result = await pool.query(query, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.status(200).json({ success: true, message: "User updated successfully", data: result.rows[0] });

    } catch (error) {
      console.error("ADMIN USER UPDATE ERROR:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
