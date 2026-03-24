import pool from "../../lib/db";
import cors from "../../lib/cors";

export default async function handler(req, res) {
  if(cors(req, res)) return;
  try {

    if (req.method === "POST") {

      const { project_id, skill_name, custom_skill } = req.body;

      if (!project_id || (!skill_name && !custom_skill)) {
        return res.status(400).json({ message: "Missing fields" });
      }

      let skill_id = null;

      if (skill_name) {
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

        skill_id = skill.rows[0].skill_id;
      }

      const result = await pool.query(
        `INSERT INTO "ProjectSkill"(project_id, skill_id, custom_skill)
         VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [project_id, skill_id, custom_skill || null]
      );

      return res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }

    if (req.method === "DELETE") {

      const { project_id, skill_id, custom_skill } = req.body;

      await pool.query(
        `DELETE FROM "ProjectSkill"
         WHERE project_id = $1
         AND (skill_id = $2 OR custom_skill = $3)`,
        [project_id, skill_id, custom_skill]
      );

      return res.status(200).json({
        message: "Project skill removed"
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}