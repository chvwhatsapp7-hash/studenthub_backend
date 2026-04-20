import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ 1. CORS FIRST (VERY IMPORTANT)
  if (cors(req, res)) return;

  // ✅ 2. AUTH AFTER CORS
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    if (req.method === "GET") {

      const { type, page = 1, limit = 10, search = "" } = req.query;
      const offset = (page - 1) * limit;

      // ───────── USERS ─────────
      if (type === "users") {

        const query = `
          SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.phone,
            u.degree,
            u.university,
            u.created_at,
            r.role_name,
            CASE 
              WHEN u.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS status
          FROM "User" u
          LEFT JOIN "Role" r ON u.role_id = r.role_id
          WHERE ($3 = '' OR u.full_name ILIKE '%' || $3 || '%'
            OR u.email ILIKE '%' || $3 || '%')
          ORDER BY u.created_at DESC
          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*) FROM "User"
          WHERE ($1 = '' OR full_name ILIKE '%' || $1 || '%'
            OR email ILIKE '%' || $1 || '%')
        `;

        const [result, countResult] = await Promise.all([
          pool.query(query, [limit, offset, search]),
          pool.query(countQuery, [search]),
        ]);

        const total = parseInt(countResult.rows[0].count);

        return res.status(200).json({
          success: true,
          type: "users",
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          data: result.rows,
        });
      }

      // ───────── COMPANIES ─────────
      if (type === "companies") {

        const query = `
          SELECT
            c.company_id,
            c.name,
 
            c.website,
            c.location,
            c.industry,
            c.created_at,
            CASE
              WHEN c.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS status
          FROM "Company" c
          WHERE ($3 = '' OR c.name ILIKE '%' || $3 || '%'
                     OR c.industry ILIKE '%' || $3 || '%')
          ORDER BY c.created_at DESC
          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*) FROM "Company"
          WHERE ($1 = '' OR name ILIKE '%' || $1 || '%'
            OR industry ILIKE '%' || $1 || '%')
        `;

        const [result, countResult] = await Promise.all([
          pool.query(query, [limit, offset, search]),
          pool.query(countQuery, [search]),
        ]);

        const total = parseInt(countResult.rows[0].count);

        return res.status(200).json({
          success: true,
          type: "companies",
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          data: result.rows,
        });
      }

      // ───────── INTERNSHIPS ─────────
      if (type === "internships") {

        const query = `
          SELECT
            i.internship_id,
            i.title,
            i.location,
            i.stipend,
            i.duration,
            i.internship_type,
            i.description,
            i.created_at,
            c.name AS company_name,
            COUNT(a.id) AS total_applications,
            CASE
              WHEN i.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS status
          FROM "Internship" i
          LEFT JOIN "Company" c ON i.company_id = c.company_id
          LEFT JOIN "Application" a ON a.internship_id = i.internship_id
          WHERE ($3 = '' OR i.title ILIKE '%' || $3 || '%'
            OR c.name ILIKE '%' || $3 || '%'
            OR i.location ILIKE '%' || $3 || '%')
          GROUP BY i.internship_id, c.name
          ORDER BY i.created_at DESC
          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*) FROM "Internship" i
          LEFT JOIN "Company" c ON i.company_id = c.company_id
          WHERE ($1 = '' OR i.title ILIKE '%' || $1 || '%'
            OR c.name ILIKE '%' || $1 || '%'
            OR i.location ILIKE '%' || $1 || '%')
        `;

        const [result, countResult] = await Promise.all([
          pool.query(query, [limit, offset, search]),
          pool.query(countQuery, [search]),
        ]);

        const total = parseInt(countResult.rows[0].count);

        return res.status(200).json({
          success: true,
          type: "internships",
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          data: result.rows,
        });
      }

      // ───────── JOBS ─────────
      if (type === "jobs") {

        const query = `
          SELECT
            j.job_id,
            j.title,
            j.location,
            j.salary_min,
            j.salary_max,
            j.job_type,
            j.experience_level,
            j.description,
            j.created_at,
            c.name AS company_name,
            COUNT(a.id) AS total_applications,
            CASE
              WHEN j.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS status
          FROM "Job" j
          LEFT JOIN "Company" c ON j.company_id = c.company_id
          LEFT JOIN "Application" a ON a.job_id = j.job_id
          WHERE ($3 = '' OR j.title ILIKE '%' || $3 || '%'
            OR c.name ILIKE '%' || $3 || '%'
            OR j.location ILIKE '%' || $3 || '%'
            OR j.job_type ILIKE '%' || $3 || '%')
          GROUP BY j.job_id, c.name
          ORDER BY j.created_at DESC
          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*) FROM "Job" j
          LEFT JOIN "Company" c ON j.company_id = c.company_id
          WHERE ($1 = '' OR j.title ILIKE '%' || $1 || '%'
            OR c.name ILIKE '%' || $1 || '%'
            OR j.location ILIKE '%' || $1 || '%'
            OR j.job_type ILIKE '%' || $1 || '%')
        `;

        const [result, countResult] = await Promise.all([
          pool.query(query, [limit, offset, search]),
          pool.query(countQuery, [search]),
        ]);

        const total = parseInt(countResult.rows[0].count);

        return res.status(200).json({
          success: true,
          type: "jobs",
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          data: result.rows,
        });
      }

      // ───────── COURSES ─────────
if (type === "courses") {

  const query = `
    SELECT
      c.course_id,
      c.title,
      c.provider,
      c.instructor,
      c.category,
      c.level,
      c.duration,
      c.target_group,
      c.created_at,
      CASE
        WHEN c.status = 1 THEN 'active'
        ELSE 'inactive'
      END AS status
    FROM "Course" c
    WHERE ($3 = '' OR c.title ILIKE '%' || $3 || '%'
      OR c.provider ILIKE '%' || $3 || '%'
      OR c.category ILIKE '%' || $3 || '%')
    ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*) FROM "Course"
    WHERE ($1 = '' OR title ILIKE '%' || $1 || '%'
      OR provider ILIKE '%' || $1 || '%'
      OR category ILIKE '%' || $1 || '%')
  `;

  const [result, countResult] = await Promise.all([
    pool.query(query, [limit, offset, search]),
    pool.query(countQuery, [search]),
  ]);

  const total = parseInt(countResult.rows[0].count);

  return res.status(200).json({
    success: true,
    type: "courses",
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    data: result.rows,
  });
}

// ───────── HACKATHONS ─────────
if (type === "hackathons") {

  const query = `
    SELECT
      h.hackathon_id,
      h.title,
      h.organizer,
      h.location,
      h.start_date,
      h.end_date,
      h.created_at,
      CASE
        WHEN h.status = 1 THEN 'active'
        ELSE 'inactive'
      END AS status
    FROM "Hackathon" h
    WHERE ($3 = '' OR h.title ILIKE '%' || $3 || '%'
      OR h.organizer ILIKE '%' || $3 || '%'
      OR h.location ILIKE '%' || $3 || '%')
    ORDER BY h.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*) FROM "Hackathon"
    WHERE ($1 = '' OR title ILIKE '%' || $1 || '%'
      OR organizer ILIKE '%' || $1 || '%'
      OR location ILIKE '%' || $1 || '%')
  `;

  const [result, countResult] = await Promise.all([
    pool.query(query, [limit, offset, search]),
    pool.query(countQuery, [search]),
  ]);

  const total = parseInt(countResult.rows[0].count);

  return res.status(200).json({
    success: true,
    type: "hackathons",
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    data: result.rows,
  });
}

      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
