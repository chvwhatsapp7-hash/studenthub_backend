import { pool } from "../../../lib/database";
import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (cors(req, res)) return;

  try {

    // =========================================================
    // ✅ GET USER BY ID (FULL PROFILE)
    // =========================================================
    if (req.method === "GET") {

      const { user_id } = req.query;

      // ✅ FIXED: rejects "null" string, undefined, non-numeric
      if (!user_id || user_id === 'null' || user_id === 'undefined' || isNaN(Number(user_id))) {
        return res.status(400).json({ success: false, message: "user_id is required" });
      }
      const parsedUserId = parseInt(user_id, 10); // ✅ safe integer

      const userQuery = `
        SELECT u.*, r.role_name
        FROM "User" u
        JOIN "Role" r ON u.role_id = r.role_id
        WHERE u.user_id = $1
      `;
      const userResult = await pool.query(userQuery, [parsedUserId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const userRow = userResult.rows[0];

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
      const applicationResult = await pool.query(applicationQuery, [parsedUserId]);

      const courseQuery = `
        SELECT 
          ce.*,
          c.title, c.provider, c.category, c.level
        FROM "CourseEnrollment" ce
        JOIN "Course" c ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
        ORDER BY ce.enrollment_date DESC
      `;
      const courseResult = await pool.query(courseQuery, [parsedUserId]);

      const hackathonQuery = `
        SELECT 
          hp.*,
          h.title, h.organizer, h.location, h.start_date, h.end_date
        FROM "HackathonParticipant" hp
        JOIN "Hackathon" h ON hp.hackathon_id = h.hackathon_id
        WHERE hp.user_id = $1
        ORDER BY hp.registration_date DESC
      `;
      const hackathonResult = await pool.query(hackathonQuery, [parsedUserId]);

      const certificateQuery = `
        SELECT certificate_id, title, issuer, issue_date, file_url, created_at
        FROM "Certificate"
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const certificateResult = await pool.query(certificateQuery, [parsedUserId]);

      const projectQuery = `
        SELECT project_id, title, description, created_at
        FROM "Project"
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const projectResult = await pool.query(projectQuery, [parsedUserId]);

      const skillQuery = `
        SELECT 
          us.id,
          us.skill_id,
          us.proficiency,
          s.name AS skill_name
        FROM "UserSkill" us
        JOIN "Skill" s ON us.skill_id = s.skill_id
        WHERE us.user_id = $1
        ORDER BY us.proficiency DESC
      `;
      const skillResult = await pool.query(skillQuery, [parsedUserId]);

      return res.status(200).json({
        success: true,
        data: {
          user: userRow,
          applications: applicationResult.rows,
          courses: courseResult.rows,
          hackathons: hackathonResult.rows,
          certificates: certificateResult.rows,
          projects: projectResult.rows,
          skills: skillResult.rows,
        },
      });
    }

    // =========================================================
    // ✅ UPDATE USER + SKILLS (PARTIAL UPDATE)
    // =========================================================
    if (req.method === "PUT") {

      const { user_id, skills, ...fields } = req.body;

      // ✅ FIXED: rejects "null" string, undefined, non-numeric
      if (!user_id || user_id === 'null' || user_id === 'undefined' || isNaN(Number(user_id))) {
        return res.status(400).json({ success: false, message: "user_id is required" });
      }
      const parsedUserId = parseInt(user_id, 10); // ✅ safe integer

      if (skills !== undefined && skills.length > 0) {
        const isValid = skills.every(
          (s) =>
            typeof s.skill_id === "number" &&
            typeof s.proficiency === "number" &&
            s.proficiency >= 1 &&
            s.proficiency <= 5
        );
        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: "Each skill must have a numeric skill_id and proficiency (1–5)",
          });
        }
      }

      const allowedFields = [
        "full_name", "email", "phone", "university", "degree",
        "graduation_year", "resume_url", "linkedin_url", "github_url",
        "about_me", "address", "age","role_id", "class","school_name","goal","status",
      ];

      const updates = Object.entries(fields).filter(
        ([key, value]) =>
          allowedFields.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ""
      );

      if (updates.length === 0 && skills === undefined) {
        return res.status(400).json({ success: false, message: "No valid fields provided to update" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        let updatedUser = null;

        if (updates.length > 0) {
          let query = `UPDATE "User" SET `;
          let values = [parsedUserId]; // ✅ parsedUserId

          const setClauses = updates.map(([key, value], index) => {
            values.push(value);
            return `"${key}" = $${index + 2}`;
          });

          query += setClauses.join(", ") + `, updated_at = NOW() WHERE user_id = $1 RETURNING *`;

          const result = await client.query(query, values);
          if (result.rowCount === 0) throw new Error("User not found");
          updatedUser = result.rows[0];
        }

        if (skills !== undefined && skills.length > 0) {
          const skillIds = skills.map((s) => s.skill_id);
          const skillCheck = await client.query(
            `SELECT skill_id FROM "Skill" WHERE skill_id = ANY($1::int[])`,
            [skillIds]
          );

          if (skillCheck.rows.length !== skillIds.length) {
            throw new Error("One or more skill_ids are invalid");
          }

          const values = [];
          const placeholders = skills.map((s, i) => {
            const base = i * 3;
            values.push(parsedUserId, s.skill_id, s.proficiency); // ✅ parsedUserId
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          });

          await client.query(
            `INSERT INTO "UserSkill" (user_id, skill_id, proficiency)
             VALUES ${placeholders.join(", ")}
             ON CONFLICT (user_id, skill_id)
             DO UPDATE SET proficiency = EXCLUDED.proficiency`,
            values
          );
        }

        await client.query("COMMIT");

        return res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          data: {
            ...(updatedUser && { user: updatedUser }),
            skills_updated: skills !== undefined ? skills.length : null,
          },
        });

      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    }

    // =========================================================
    // ❌ METHOD NOT ALLOWED
    // =========================================================
    return res.status(405).json({ success: false, message: "Method not allowed" });

  } catch (err) {
    console.error("PROFILE ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
