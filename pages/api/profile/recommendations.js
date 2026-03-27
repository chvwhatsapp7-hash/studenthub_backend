// api/profile/recommendations.js
import pool from '../../../lib/db';
import { cors } from '../../../lib/cors';
import { authenticate } from "../../../lib/auth";


export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
  
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Only GET allowed' });

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });

  try {
    const [jobsResult, internshipsResult, coursesResult] = await Promise.all([

      // ── MATCHING JOBS ──────────────────────────────────────────────
      pool.query(`
        SELECT
          j.job_id,
          j.title,
          j.location,
          j.job_type,
          j.salary_min,
          j.salary_max,
          j.experience_level,
          j.apply_url,
          j.created_at,
          c.name     AS company_name,
          c.logo_url AS company_logo,

          COALESCE(
            JSON_AGG(DISTINCT s_match.name) FILTER (WHERE s_match.name IS NOT NULL),
            '[]'
          ) AS matched_skills,

          COALESCE(
            JSON_AGG(DISTINCT s_all.name) FILTER (WHERE s_all.name IS NOT NULL),
            '[]'
          ) AS required_skills,

          COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL) AS matched_count,
          COUNT(DISTINCT js_all.skill_id)                                     AS total_required,

          CASE
            WHEN COUNT(DISTINCT js_all.skill_id) = 0 THEN 0
            ELSE ROUND(
              COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL) * 100.0
              / COUNT(DISTINCT js_all.skill_id)
            )
          END AS match_percentage

        FROM "Job" j
        JOIN "Company" c       ON j.company_id  = c.company_id
        LEFT JOIN "JobSkill"  js_all   ON j.job_id     = js_all.job_id
        LEFT JOIN "Skill"     s_all    ON js_all.skill_id = s_all.skill_id
        LEFT JOIN "UserSkill" us       ON js_all.skill_id = us.skill_id AND us.user_id = $1
        LEFT JOIN "Skill"     s_match  ON us.skill_id   = s_match.skill_id

        WHERE j.status = 1 AND c.status = 1

        GROUP BY
          j.job_id, j.title, j.location, j.job_type,
          j.salary_min, j.salary_max, j.experience_level,
          j.apply_url, j.created_at,
          c.name, c.logo_url

        ORDER BY match_percentage DESC, j.created_at DESC
        LIMIT 20
      `, [user_id]),

      // ── MATCHING INTERNSHIPS ───────────────────────────────────────
      pool.query(`
        SELECT
          i.internship_id,
          i.title,
          i.location,
          i.stipend,
          i.duration,
          i.internship_type,
          i.start_date,
          i.apply_url,
          i.created_at,
          c.name     AS company_name,
          c.logo_url AS company_logo,

          COALESCE(
            JSON_AGG(DISTINCT s_match.name) FILTER (WHERE s_match.name IS NOT NULL),
            '[]'
          ) AS matched_skills,

          COALESCE(
            JSON_AGG(DISTINCT s_all.name) FILTER (WHERE s_all.name IS NOT NULL),
            '[]'
          ) AS required_skills,

          COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL) AS matched_count,
          COUNT(DISTINCT is_all.skill_id)                                     AS total_required,

          CASE
            WHEN COUNT(DISTINCT is_all.skill_id) = 0 THEN 0
            ELSE ROUND(
              COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL) * 100.0
              / COUNT(DISTINCT is_all.skill_id)
            )
          END AS match_percentage

        FROM "Internship" i
        JOIN "Company" c              ON i.company_id    = c.company_id
        LEFT JOIN "InternshipSkill" is_all ON i.internship_id = is_all.internship_id
        LEFT JOIN "Skill"           s_all  ON is_all.skill_id = s_all.skill_id
        LEFT JOIN "UserSkill"       us     ON is_all.skill_id = us.skill_id AND us.user_id = $1
        LEFT JOIN "Skill"           s_match ON us.skill_id   = s_match.skill_id

        WHERE i.status = 1 AND c.status = 1

        GROUP BY
          i.internship_id, i.title, i.location, i.stipend,
          i.duration, i.internship_type, i.start_date,
          i.apply_url, i.created_at,
          c.name, c.logo_url

        ORDER BY match_percentage DESC, i.created_at DESC
        LIMIT 20
      `, [user_id]),

      // ── MATCHING COURSES ───────────────────────────────────────────
      pool.query(`
        SELECT
          co.course_id,
          co.title,
          co.description,
          co.provider,
          co.category,
          co.level,
          co.duration,
          co.course_url,
          co.price,
          co.rating,

          COALESCE(
            JSON_AGG(DISTINCT s_all.name) FILTER (WHERE s_all.name IS NOT NULL),
            '[]'
          ) AS course_skills,

          COALESCE(
            JSON_AGG(DISTINCT s_missing.name) FILTER (WHERE s_missing.name IS NOT NULL),
            '[]'
          ) AS missing_skills,

          COUNT(DISTINCT cs_all.skill_id)                                          AS total_skills,
          COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL)       AS already_known,
          COUNT(DISTINCT cs_all.skill_id)
            - COUNT(DISTINCT us.skill_id) FILTER (WHERE us.skill_id IS NOT NULL)   AS gap_fill_count

        FROM "Course" co
        LEFT JOIN "CourseSkill" cs_all   ON co.course_id   = cs_all.course_id
        LEFT JOIN "Skill"       s_all    ON cs_all.skill_id = s_all.skill_id
        LEFT JOIN "UserSkill"   us       ON cs_all.skill_id = us.skill_id AND us.user_id = $1
        LEFT JOIN "Skill"       s_missing ON cs_all.skill_id = s_missing.skill_id
                                          AND us.skill_id IS NULL

        WHERE co.status = 1

        GROUP BY
          co.course_id, co.title, co.description, co.provider,
          co.category, co.level, co.duration, co.course_url,
          co.price, co.rating

        HAVING COUNT(DISTINCT cs_all.skill_id) > 0

        ORDER BY gap_fill_count DESC, co.rating DESC NULLS LAST
        LIMIT 15
      `, [user_id]),

    ]);

    return res.status(200).json({
      success: true,
      data: {
        jobs: jobsResult.rows.map(row => ({
          job_id:          row.job_id,
          title:           row.title,
          location:        row.location,
          job_type:        row.job_type,
          salary_min:      row.salary_min,
          salary_max:      row.salary_max,
          experience_level:row.experience_level,
          apply_url:       row.apply_url,
          company_name:    row.company_name,
          company_logo:    row.company_logo,
          matched_skills:  row.matched_skills,
          required_skills: row.required_skills,
          matched_count:   parseInt(row.matched_count),
          total_required:  parseInt(row.total_required),
          match_percentage:parseInt(row.match_percentage),
        })),

        internships: internshipsResult.rows.map(row => ({
          internship_id:   row.internship_id,
          title:           row.title,
          location:        row.location,
          stipend:         row.stipend,
          duration:        row.duration,
          internship_type: row.internship_type,
          start_date:      row.start_date,
          apply_url:       row.apply_url,
          company_name:    row.company_name,
          company_logo:    row.company_logo,
          matched_skills:  row.matched_skills,
          required_skills: row.required_skills,
          matched_count:   parseInt(row.matched_count),
          total_required:  parseInt(row.total_required),
          match_percentage:parseInt(row.match_percentage),
        })),

        courses: coursesResult.rows.map(row => ({
          course_id:     row.course_id,
          title:         row.title,
          description:   row.description,
          provider:      row.provider,
          category:      row.category,
          level:         row.level,
          duration:      row.duration,
          course_url:    row.course_url,
          price:         row.price,
          rating:        row.rating,
          course_skills: row.course_skills,
          missing_skills:row.missing_skills,
          total_skills:  parseInt(row.total_skills),
          already_known: parseInt(row.already_known),
          gap_fill_count:parseInt(row.gap_fill_count),
        })),
      },
    });

  } catch (err) {
    console.error('RECOMMENDATIONS ERROR:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
}
