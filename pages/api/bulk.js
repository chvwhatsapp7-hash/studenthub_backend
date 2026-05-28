import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ 1. CORS FIRST
  if (cors(req, res)) return;

  // ✅ 2. AUTH
  const user = authenticate(req, res);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {

    if (req.method === "GET") {

      const {
        type,
        page = 1,
        limit = 10,
        search = "",
        searchColumn = "Name"
      } = req.query;

      const offset = (page - 1) * limit;

      // =========================================================
      // USERS
      // =========================================================

      if (type === "users") {

        const buildWhereClause = (paramIndex) => {
          const baseCondition = `(u.is_deleted IS NOT TRUE OR u.is_deleted IS NULL)`;
          if (searchColumn === 'Name') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR u.full_name ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Email') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR u.email ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Phone') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR u.phone ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Institution') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR u.university ILIKE '%' || $${paramIndex} || '%' OR u.school_name ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Degree/Class') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR u.degree ILIKE '%' || $${paramIndex} || '%' OR u.class ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Role') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR r.role_name ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Status') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR (CASE WHEN u.status = 1 THEN 'active' ELSE 'inactive' END) ILIKE '%' || $${paramIndex} || '%')`;
          if (searchColumn === 'Age') return `WHERE ${baseCondition} AND ($${paramIndex} = '' OR CAST(u.age AS TEXT) ILIKE '%' || $${paramIndex} || '%')`;
          
          return `
            WHERE ${baseCondition} AND (
              $${paramIndex} = ''
              OR u.full_name ILIKE '%' || $${paramIndex} || '%'
              OR u.email ILIKE '%' || $${paramIndex} || '%'
              OR u.phone ILIKE '%' || $${paramIndex} || '%'
              OR u.university ILIKE '%' || $${paramIndex} || '%'
              OR u.school_name ILIKE '%' || $${paramIndex} || '%'
              OR u.degree ILIKE '%' || $${paramIndex} || '%'
            )
          `;
        };

        const query = `
          SELECT 
            CAST(u.user_id AS INTEGER) AS user_id,

            u.full_name,
            u.email,
            u.phone,

            -- 🎓 College
            u.university,
            u.degree,
            u.graduation_year,

            -- 🏫 School
            u.class,
            u.school_name,

            -- 🎯 Goal
            u.goal,

            -- 🌐 Links
            u.resume_url,
            u.profile_image_url,
            u.linkedin_url,
            u.github_url,

            -- 👤 Extra
            u.age,
            u.about_me,
            u.address,

            -- 🔐 Auth
            u.auth_provider,
            u.firebase_uid,

            -- 🛡 Role
            CAST(u.role_id AS INTEGER) AS role_id,
            r.role_name,

            -- 📌 Status
            CASE 
              WHEN u.status = 1 THEN 'active'
              ELSE 'inactive'
            END AS status,

            -- 📅 Dates
            u.created_at,
            u.updated_at

          FROM "User" u

          LEFT JOIN "Role" r
          ON u.role_id = r.role_id

          ${buildWhereClause(3)}

          ORDER BY u.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "User" u

          LEFT JOIN "Role" r
          ON u.role_id = r.role_id

          ${buildWhereClause(1)}
        `;

         const statsQuery = `
  SELECT
    COUNT(*) FILTER (
      WHERE u.role_id = 1
    ) AS admins,

    COUNT(*) FILTER (
      WHERE u.role_id = 2
    ) AS school_students,

    COUNT(*) FILTER (
      WHERE u.role_id IN (3, 4)
    ) AS college_students

  FROM "User" u
`;
        const [result, countResult, statsResult] = await Promise.all([
          pool.query(query, [limit, offset, search]),
          pool.query(countQuery, [search]),
          pool.query(statsQuery),
        ]);

        const total = parseInt(countResult.rows[0].count);
        const stats = {
          admins: parseInt(statsResult.rows[0].admins || 0),
          schoolStudents: parseInt(statsResult.rows[0].school_students || 0),
          collegeStudents: parseInt(statsResult.rows[0].college_students || 0),
        };

        return res.status(200).json({
          success: true,
          type: "users",
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          stats,
          data: result.rows,
        });
      }

      // =========================================================
      // COMPANIES
      // =========================================================

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

          WHERE (
            $3 = ''
            OR c.name ILIKE '%' || $3 || '%'
            OR c.industry ILIKE '%' || $3 || '%'
          )

          ORDER BY c.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "Company"

          WHERE (
            $1 = ''
            OR name ILIKE '%' || $1 || '%'
            OR industry ILIKE '%' || $1 || '%'
          )
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

      // =========================================================
      // INTERNSHIPS
      // =========================================================

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

          LEFT JOIN "Company" c
          ON i.company_id = c.company_id

          LEFT JOIN "Application" a
          ON a.internship_id = i.internship_id

          WHERE (
            $3 = ''
            OR i.title ILIKE '%' || $3 || '%'
            OR c.name ILIKE '%' || $3 || '%'
            OR i.location ILIKE '%' || $3 || '%'
          )

          GROUP BY i.internship_id, c.name

          ORDER BY i.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "Internship" i

          LEFT JOIN "Company" c
          ON i.company_id = c.company_id

          WHERE (
            $1 = ''
            OR i.title ILIKE '%' || $1 || '%'
            OR c.name ILIKE '%' || $1 || '%'
            OR i.location ILIKE '%' || $1 || '%'
          )
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

      // =========================================================
      // JOBS
      // =========================================================

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

          LEFT JOIN "Company" c
          ON j.company_id = c.company_id

          LEFT JOIN "Application" a
          ON a.job_id = j.job_id

          WHERE (
            $3 = ''
            OR j.title ILIKE '%' || $3 || '%'
            OR c.name ILIKE '%' || $3 || '%'
            OR j.location ILIKE '%' || $3 || '%'
            OR j.job_type ILIKE '%' || $3 || '%'
          )

          GROUP BY j.job_id, c.name

          ORDER BY j.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "Job" j

          LEFT JOIN "Company" c
          ON j.company_id = c.company_id

          WHERE (
            $1 = ''
            OR j.title ILIKE '%' || $1 || '%'
            OR c.name ILIKE '%' || $1 || '%'
            OR j.location ILIKE '%' || $1 || '%'
            OR j.job_type ILIKE '%' || $1 || '%'
          )
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

      // =========================================================
      // COURSES
      // =========================================================

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

          WHERE (
            $3 = ''
            OR c.title ILIKE '%' || $3 || '%'
            OR c.provider ILIKE '%' || $3 || '%'
            OR c.category ILIKE '%' || $3 || '%'
          )

          ORDER BY c.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "Course"

          WHERE (
            $1 = ''
            OR title ILIKE '%' || $1 || '%'
            OR provider ILIKE '%' || $1 || '%'
            OR category ILIKE '%' || $1 || '%'
          )
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

      // =========================================================
      // HACKATHONS
      // =========================================================

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

          WHERE (
            $3 = ''
            OR h.title ILIKE '%' || $3 || '%'
            OR h.organizer ILIKE '%' || $3 || '%'
            OR h.location ILIKE '%' || $3 || '%'
          )

          ORDER BY h.created_at DESC

          LIMIT $1 OFFSET $2
        `;

        const countQuery = `
          SELECT COUNT(*)

          FROM "Hackathon"

          WHERE (
            $1 = ''
            OR title ILIKE '%' || $1 || '%'
            OR organizer ILIKE '%' || $1 || '%'
            OR location ILIKE '%' || $1 || '%'
          )
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

      // =========================================================
      // INVALID TYPE
      // =========================================================

      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    // =========================================================
    // METHOD NOT ALLOWED
    // =========================================================

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