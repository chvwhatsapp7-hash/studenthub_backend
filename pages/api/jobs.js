import pool from "../../lib/db";
import{cors} from "../../lib/cors";


export default async function handler(req, res) {
    if (cors(req, res)) return;

  try {

    // ═══════════════════════════════════════════
    //  POST — Create Job + Link Skills
    // ═══════════════════════════════════════════
    if (req.method === "POST") {
      const {
        title,
        company_id,
        location,
        description,
        skills = [], // ✅ array of skill_ids e.g. [1, 2, 3]
      } = req.body;

      // 1️⃣ Insert the job
      const jobResult = await pool.query(
        `
        INSERT INTO "Job"
        (title, company_id, location, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
        `,
        [title, company_id, location, description]
      );

      const job = jobResult.rows[0];

      // 2️⃣ Insert each skill into JobSkill table
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
    //  GET — Fetch All Jobs with Skills
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
    //  PUT — Update Job + Re-link Skills
    // ═══════════════════════════════════════════
    else if (req.method === "PUT") {
      const {
        job_id,
        title,
        company_id,
        location,
        description,
        skills = [], // ✅ optional — pass new skill_ids to update
      } = req.body;

      // 1️⃣ Update job details
      const result = await pool.query(
        `
        UPDATE "Job"
        SET title = $1,
            company_id = $2,
            location = $3,
            description = $4,
            updated_at = NOW()
        WHERE job_id = $5
        RETURNING *
        `,
        [title, company_id, location, description, job_id]
      );

      // 2️⃣ If skills provided, delete old and re-insert
      if (skills.length > 0) {
        await pool.query(
          `DELETE FROM "JobSkill" WHERE job_id = $1`,
          [job_id]
        );

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
    //  DELETE — Remove Job (cascade removes JobSkill)
    // ═══════════════════════════════════════════
    else if (req.method === "DELETE") {
      const { job_id } = req.body;

      // 1️⃣ Delete linked skills first
      await pool.query(
        `DELETE FROM "JobSkill" WHERE job_id = $1`,
        [job_id]
      );

      // 2️⃣ Delete the job
      const result = await pool.query(
        `
        DELETE FROM "Job"
        WHERE job_id = $1
        RETURNING *
        `,
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
