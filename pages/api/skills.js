import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
  
  if (cors(req, res)) return;

  try {

    if (req.method === "GET") {

      const result = await pool.query(`SELECT skill_id, name FROM "Skill" ORDER BY name`);

      return res.status(200).json({
        success: true,
        skills: result.rows
      });
    }

    if (req.method === "POST") {

      let { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Skill name required" });
      }

      name = name.toLowerCase().trim();

      
      const existing = await pool.query(
        `SELECT * FROM "Skill" WHERE name = $1`,
        [name]
      );

      if (existing.rows.length > 0) {
        return res.status(200).json({
          message: "Skill already exists",
          data: existing.rows[0]
        });
      }

      const result = await pool.query(
        `INSERT INTO "Skill" (name) VALUES ($1) RETURNING *`,
        [name]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}