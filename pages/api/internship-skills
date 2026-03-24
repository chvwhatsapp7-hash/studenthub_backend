import pool from "../../lib/db";
import{cors} from "../../lib/cors";

export default async function handler(req, res) {
    if (cors(req, res)) return;
  try {

    if (req.method === "POST") {

      const { internship_id, skill_name } = req.body;

      if (!internship_id || !skill_name) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const name = skill_name.toLowerCase().trim();

      let skill = await pool.query(
        `SELECT * FROM "Skill" WHERE name = $1`,
        [name]
      );

      if (skill.rows.length === 0) {
        skill = await pool.query(
          `INSERT INTO "Skill"(name) VALUES($1) RETURNING *`,
          [name]
        );
      }

      const skill_id = skill.rows[0].skill_id;

      const result = await pool.query(
        `INSERT INTO "InternshipSkill"(internship_id, skill_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [internship_id, skill_id]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }

    if (req.method === "DELETE") {

      const { internship_id, skill_id } = req.body;

      await pool.query(
        `DELETE FROM "InternshipSkill"
         WHERE internship_id = $1 AND skill_id = $2`,
        [internship_id, skill_id]
      );

      return res.status(200).json({ message: "Removed" });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}