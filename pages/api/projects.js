import pool from "../../lib/db";
import cors from "../../lib/cors";

export default async function handler(req, res) {
  if(cors(req, res)) return;
  try {

    if (req.method === "POST") {

      const { user_id, title, description } = req.body;

      if (!user_id || !title || !description) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const result = await pool.query(
        `INSERT INTO "Project"(user_id, title, description, created_at)
         VALUES ($1,$2,$3,NOW())
         RETURNING *`,
        [user_id, title, description]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }

    if (req.method === "DELETE") {

      const { project_id } = req.body;

      await pool.query(
        `DELETE FROM "Project"
         WHERE project_id = $1`,
        [project_id]
      );

      return res.status(200).json({
        message: "Project deleted"
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}