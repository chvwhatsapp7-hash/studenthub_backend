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
    const { company_id } = req.query;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: "company_id is required",
      });
    }

    const query = `
      SELECT 
        c.company_id,
        c.name,
        c.description,
        c.industry,
        c.website,
        c.logo_url,
        c.location,
        c.company_size,
        c.founded_year,
        c.created_at,
        c.status,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'job_id', j.job_id,
              'title', j.title,
              'location', j.location,
              'salary_min', j.salary_min,
              'salary_max', j.salary_max
            )
          ) FILTER (WHERE j.job_id IS NOT NULL),
          '[]'
        ) AS jobs,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'internship_id', i.internship_id,
              'title', i.title,
              'location', i.location,
              'stipend', i.stipend
            )
          ) FILTER (WHERE i.internship_id IS NOT NULL),
          '[]'
        ) AS internships,

        COUNT(DISTINCT j.job_id) AS total_jobs,
        COUNT(DISTINCT i.internship_id) AS total_internships

      FROM "Company" c
      LEFT JOIN "Job" j ON j.company_id = c.company_id AND j.status = 1
      LEFT JOIN "Internship" i ON i.company_id = c.company_id AND i.status = 1

      WHERE c.company_id = $1

      GROUP BY c.company_id;
    `;

    const result = await pool.query(query, [company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    console.error("COMPANY DETAILS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}