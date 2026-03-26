import pool from "../../lib/db";
import { cors } from "../../lib/cors";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {

    // ═══════════════════════════════════════════
    // POST — Create Job + Skills
    // ═══════════════════════════════════════════
    if (req.method === "POST") {
      const {
        title,
        company_id,
        location,
        description,
        salary_min,
        salary_max,
        job_type,
        experience_level,
        skills = [],
      } = req.body;

      const jobResult = await pool.query(
        `
        INSERT INTO "Job"
        (
          title,
          company_id,
          location,
          description,
          salary_min,
          salary_max,
          job_type,
          experience_level,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
        RETURNING *
        `,
        [
          title,
          company_id,
          location,
          description,
          salary_min,
          salary_max,
          job_type,
          experience_level
        ]
      );

      const job = jobResult.rows[0];

      // Insert skills
      if (skills.length > 0) {
        for (const skill_id of skills) {
          await pool.query(
            `
            INSERT INTO "JobSkill" (job_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [job.job_id, skill_id]
          );
        }
      }

      return res.status(201).json({
        success: true,
        data: job,
      });
    }

    // ═══════════════════════════════════════════
    // GET — Fetch Jobs
    // ═══════════════════════════════════════════
    else if (req.method === "GET") {
      const result = await pool.query(`
        SELECT
          j.*,
          COALESCE(
            json_agg(s.name) FILTER (WHERE s.name IS NOT NULL), '[]'
          ) AS skills
        FROM "Job" j
        LEFT JOIN "JobSkill" js ON js.job_id = j.job_id
        LEFT JOIN "Skill" s ON s.skill_id = js.skill_id
        GROUP BY j.job_id
        ORDER BY j.created_at DESC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // ═══════════════════════════════════════════
    // PUT — Update Job
    // ═══════════════════════════════════════════
    else if (req.method === "PUT") {
      const {
        job_id,
        title,
        company_id,
        location,
        description,
        salary_min,
        salary_max,
        job_type,
        experience_level,
        skills = [],
      } = req.body;

      const result = await pool.query(
        `
        UPDATE "Job"
        SET
          title = $1,
          company_id = $2,
          location = $3,
          description = $4,
          salary_min = $5,
          salary_max = $6,
          job_type = $7,
          experience_level = $8,
          updated_at = NOW()
        WHERE job_id = $9
        RETURNING *
        `,
        [
          title,
          company_id,
          location,
          description,
          salary_min,
          salary_max,
          job_type,
          experience_level,
          job_id
        ]
      );

      // Update skills
      if (skills.length > 0) {
        await pool.query(`DELETE FROM "JobSkill" WHERE job_id = $1`, [job_id]);

        for (const skill_id of skills) {
          await pool.query(
            `
            INSERT INTO "JobSkill" (job_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [job_id, skill_id]
          );
        }
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    }

    // ═══════════════════════════════════════════
    // DELETE — Remove Job
    // ═══════════════════════════════════════════
    else if (req.method === "DELETE") {
      const { job_id } = req.body;

      await pool.query(`DELETE FROM "JobSkill" WHERE job_id = $1`, [job_id]);

      const result = await pool.query(
        `DELETE FROM "Job" WHERE job_id = $1 RETURNING *`,
        [job_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
}