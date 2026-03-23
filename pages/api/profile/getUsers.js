import { pool } from "../../../lib/database";

export default async function handler(req, res) {
  try {

    // =========================================================
    // ✅ GET USER BY ID (FULL PROFILE)
    // =========================================================
    if (req.method === "GET") {

      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "user_id is required"
        });
      }

      // ✅ USER DETAILS + ROLE
      const userQuery = `
        SELECT u.*, r.role_name
        FROM "User" u
        JOIN "Role" r ON u.role_id = r.role_id
        WHERE u.user_id = $1
      `;
      const userResult = await pool.query(userQuery, [user_id]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const user = userResult.rows[0];

      // =========================================================
      // ✅ APPLICATIONS
      // =========================================================
      const applicationQuery = `
        SELECT 
          a.*,
          j.job_id, j.title AS job_title, j.location AS job_location,
          jc.name AS job_company_name,
          i.internship_id, i.title AS internship_title, i.location AS internship_location,
          ic.name AS internship_company_name
        FROM "Application" a
        LEFT JOIN "Job" j ON a.job_id = j.job_id
        LEFT JOIN "Company" jc ON j.company_id = jc.company_id
        LEFT JOIN "Internship" i ON a.internship_id = i.internship_id
        LEFT JOIN "Company" ic ON i.company_id = ic.company_id
        WHERE a.user_id = $1
        ORDER BY a.applied_at DESC
      `;
      const applicationResult = await pool.query(applicationQuery, [user_id]);

      // =========================================================
      // ✅ COURSES
      // =========================================================
      const courseQuery = `
        SELECT 
          ce.*,
          c.title, c.provider, c.category, c.level
        FROM "CourseEnrollment" ce
        JOIN "Course" c ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
        ORDER BY ce.enrollment_date DESC
      `;
      const courseResult = await pool.query(courseQuery, [user_id]);

      // =========================================================
      // ✅ HACKATHONS
      // =========================================================
      const hackathonQuery = `
        SELECT 
          hp.*,
          h.title, h.organizer, h.location, h.start_date, h.end_date
        FROM "HackathonParticipant" hp
        JOIN "Hackathon" h ON hp.hackathon_id = h.hackathon_id
        WHERE hp.user_id = $1
        ORDER BY hp.registration_date DESC
      `;
      const hackathonResult = await pool.query(hackathonQuery, [user_id]);

      // =========================================================
      // ✅ CERTIFICATES
      // =========================================================
      const certificateQuery = `
        SELECT certificate_id, title, issuer, issue_date, file_url, created_at
        FROM "Certificate"
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const certificateResult = await pool.query(certificateQuery, [user_id]);

      // =========================================================
      // ✅ PROJECTS
      // =========================================================
      const projectQuery = `
        SELECT project_id, title, description, created_at
        FROM "Project"
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const projectResult = await pool.query(projectQuery, [user_id]);

      // =========================================================
      // ✅ FINAL RESPONSE
      // =========================================================
      return res.status(200).json({
        success: true,
        data: {
          user,
          applications: applicationResult.rows,
          courses: courseResult.rows,
          hackathons: hackathonResult.rows,
          certificates: certificateResult.rows,
          projects: projectResult.rows
        }
      });
    }

    // =========================================================
    // ✅ UPDATE USER (PARTIAL UPDATE USING USER_ID)
    // =========================================================
    if (req.method === "PUT") {

      const { user_id, ...fields } = req.body;

      // ✅ Validate user_id
      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "user_id is required"
        });
      }

      // ✅ Allowed fields
      const allowedFields = [
        "full_name",
        "email",
        "phone",
        "university",
        "degree",
        "graduation_year",
        "resume_url",
        "linkedin_url",
        "github_url",
        "about_me",
        "address",
        "age"
      ];

      // ✅ Filter valid fields only
      const updates = Object.entries(fields).filter(
        ([key, value]) =>
          allowedFields.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ""
      );

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields provided to update"
        });
      }

      // ✅ Build dynamic SQL
      let query = `UPDATE "User" SET `;
      let values = [user_id];

      updates.forEach(([key, value], index) => {
        query += `"${key}" = $${index + 2}, `;
        values.push(value);
      });

      // ✅ Add timestamp + condition
      query += `updated_at = NOW() WHERE user_id = $1 RETURNING *`;

      const result = await pool.query(query, values);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // ❌ METHOD NOT ALLOWED
    // =========================================================
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
