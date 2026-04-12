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
    const { internship_id } = req.query;

    if (!internship_id) {
      return res.status(400).json({
        success: false,
        message: "internship_id is required",
      });
    }

    const query = `
      SELECT 
        i.internship_id,
        i.title,
        i.description,
        i.location,
        i.stipend,
        i.duration,
        i.internship_type,
        i.start_date,
        i.application_deadline,
        i.apply_url,
        i.created_at,
        i.status,

        c.company_id,
        c.name AS company_name,
        c.logo_url,
        c.website,

        COUNT(a.id) AS total_applications,

        COALESCE(
          json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL),
          '[]'
        ) AS skills

      FROM "Internship" i
      LEFT JOIN "Company" c ON i.company_id = c.company_id
      LEFT JOIN "Application" a ON a.internship_id = i.internship_id
      LEFT JOIN "InternshipSkill" iskill ON iskill.internship_id = i.internship_id
      LEFT JOIN "Skill" s ON s.skill_id = iskill.skill_id

      WHERE i.internship_id = $1

      GROUP BY i.internship_id, c.company_id;
    `;

    const result = await pool.query(query, [internship_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Internship not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });

  } catch (err) {
    console.error("INTERNSHIP DETAILS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}