import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotificationToAll } from "../../lib/sendNotificationToAll";

export default async function handler(req, res) {

  // ✅ CORS FIRST
  if (cors(req, res)) return;

  // ✅ AUTH
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {

    // =========================================================
    // POST — Create Job + Skills + Notification
    // =========================================================
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

      if (!title || !company_id || !location || !description) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields"
        });
      }

      console.log("📥 Creating job:", title);

      // 🔹 Insert Job
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
        [title, company_id, location, description, salary_min, salary_max, job_type, experience_level]
      );

      const job = jobResult.rows[0];

      // 🔹 Insert skills
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

      // =====================================================
      // 🔔 STORE NOTIFICATION (FULL MODEL SUPPORT)
      // =====================================================
      try {
        console.log("🔥 Inserting job notifications...");

        const notifResult = await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, redirect_url, is_read, created_at)
          SELECT user_id,
                 $1,
                 $2,
                 'job',
                 $3,
                 $4,
                 false,
                 NOW()
          FROM "User"
          RETURNING notification_id
          `,
          [
            "New Job Posted",
            `${title} job is now available`,
            job.job_id,
            `/jobs/${job.job_id}`
          ]
        );

        console.log("✅ Notifications inserted:", notifResult.rowCount);

      } catch (err) {
        console.error("❌ Notification insert failed:", err.message);
      }

      // =====================================================
      // 🔥 PUSH NOTIFICATION (SAFE)
      // =====================================================
      try {
        await sendNotificationToAll(
          "New Job Posted",
          `${title} job is now available`
        );
      } catch (err) {
        console.error("❌ Push failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Job created successfully",
        data: job
      });
    }

    // =========================================================
    // GET — Fetch Jobs with Skills
    // =========================================================
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
        data: result.rows
      });
    }

    // =========================================================
    // PUT — Update Job
    // =========================================================
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
        SET title=$1,
            company_id=$2,
            location=$3,
            description=$4,
            salary_min=$5,
            salary_max=$6,
            job_type=$7,
            experience_level=$8,
            updated_at = NOW()
        WHERE job_id=$9
        RETURNING *
        `,
        [title, company_id, location, description, salary_min, salary_max, job_type, experience_level, job_id]
      );

      // 🔹 Update skills
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
        message: "Job updated successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Remove Job
    // =========================================================
    else if (req.method === "DELETE") {

      const { job_id } = req.body;

      await pool.query(`DELETE FROM "JobSkill" WHERE job_id = $1`, [job_id]);

      const result = await pool.query(
        `DELETE FROM "Job" WHERE job_id=$1 RETURNING *`,
        [job_id]
      );

      return res.status(200).json({
        success: true,
        message: "Job deleted successfully",
        data: result.rows[0]
      });
    }

    return res.status(405).json({
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("🔥 JOB API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}