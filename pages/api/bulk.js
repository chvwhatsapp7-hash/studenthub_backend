import pool from "../../lib/db";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {

      const { type, page = 1, limit = 10, search = "" } = req.query;
      const offset = (page - 1) * limit;


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
      
      
      return res.status(400).json({
        success: false,
        message: "Invalid type. Use: users | companies | internships | jobs",
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
