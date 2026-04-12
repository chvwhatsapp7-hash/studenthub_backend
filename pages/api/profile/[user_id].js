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
    const { user_id } = req.query;

    // ================= USER =================
    const userResult = await pool.query(
      `SELECT user_id, full_name, email, phone, university, degree,
              graduation_year, resume_url, linkedin_url, github_url,
              about_me, address, age, created_at
       FROM "User"
       WHERE user_id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userResult.rows[0];

    // ================= SKILLS =================
    const skillsResult = await pool.query(
      `SELECT s.skill_id, s.name, us.proficiency
       FROM "UserSkill" us
       JOIN "Skill" s ON s.skill_id = us.skill_id
       WHERE us.user_id = $1`,
      [user_id]
    );

    // ================= CERTIFICATES =================
    const certResult = await pool.query(
      `SELECT certificate_id, title, issuer, issue_date, file_url
       FROM "Certificate"
       WHERE user_id = $1`,
      [user_id]
    );

    // ================= PROJECTS =================
    const projectsResult = await pool.query(
      `SELECT p.project_id, p.title, p.description,
              COALESCE(
                json_agg(s.name) FILTER (WHERE s.name IS NOT NULL),
                '[]'
              ) AS skills
       FROM "Project" p
       LEFT JOIN "ProjectSkill" ps ON ps.project_id = p.project_id
       LEFT JOIN "Skill" s ON s.skill_id = ps.skill_id
       WHERE p.user_id = $1
       GROUP BY p.project_id`,
      [user_id]
    );

    // ================= PROFILE STRENGTH =================
    let score = 0;

    if (userData.full_name) score += 10;
    if (userData.email) score += 10;
    if (userData.phone) score += 10;
    if (userData.university) score += 10;
    if (userData.degree) score += 10;
    if (userData.resume_url) score += 10;
    if (skillsResult.rows.length > 0) score += 20;
    if (projectsResult.rows.length > 0) score += 10;
    if (certResult.rows.length > 0) score += 10;

    // ================= FINAL RESPONSE =================
    return res.status(200).json({
      success: true,
      data: {
        ...userData,
        skills: skillsResult.rows,
        certificates: certResult.rows,
        projects: projectsResult.rows,
        profile_strength: score
      }
    });

  } catch (err) {
    console.error("PROFILE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}