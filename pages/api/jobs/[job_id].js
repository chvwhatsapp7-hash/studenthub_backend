import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { job_id } = req.query;

    if (!job_id) {
      return res.status(400).json({
        success: false,
        message: "job_id is required",
      });
    }

    const query = `
      SELECT 
        j.job_id,
        j.title,
        j.description,
        j.location,
        j.job_type,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.application_deadline,
        j.apply_url,
        j.created_at,
        j.status,

        c.company_id,
        c.name AS company_name,
        c.logo_url,
        c.website,
        c.location AS company_location,

        COUNT(a.id) AS total_applications,

        COALESCE(
          json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),
          '[]'
        ) AS skills

      FROM "Job" j
      LEFT JOIN "Company" c ON j.company_id = c.company_id
      LEFT JOIN "Application" a ON a.job_id = j.job_id
      LEFT JOIN "JobSkill" js ON js.job_id = j.job_id
      LEFT JOIN "Skill" s ON s.skill_id = js.skill_id

      WHERE j.job_id = $1

      GROUP BY j.job_id, c.company_id;
    `;

    const result = await pool.query(query, [job_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    console.error("JOB DETAILS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}