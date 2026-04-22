import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ CORS FIRST
  if (cors(req, res)) return;

  // ✅ AUTH
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = user.user_id;

  try {

    // =========================================================
    // GET — Get enrolled courses WITH progress
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT 
          c.course_id,
          c.title,
          ce.progress,
          ce.completed
        FROM "CourseEnrollment" ce
        JOIN "Course" c 
          ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
        ORDER BY ce.enrollment_date DESC
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Enroll + initialize progress
    // =========================================================
    if (req.method === "POST") {

      const { course_id } = req.body;

      if (!course_id) {
        return res.status(400).json({
          success: false,
          message: "course_id is required"
        });
      }

      // 🔍 Duplicate check
      const check = await pool.query(
        `SELECT 1 FROM "CourseEnrollment"
         WHERE user_id = $1 AND course_id = $2`,
        [user_id, course_id]
      );

      if (check.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Already enrolled"
        });
      }

      // 🔹 Insert enrollment (WITH progress)
      const insert = await pool.query(
        `
        INSERT INTO "CourseEnrollment"
        (user_id, course_id, progress, completed, enrollment_date)
        VALUES ($1,$2,0,false,NOW())
        RETURNING *
        `,
        [user_id, course_id]
      );

      const enrollment = insert.rows[0];

      // 🔍 Get course title
      const courseRes = await pool.query(
        `SELECT title FROM "Course" WHERE course_id = $1`,
        [course_id]
      );

      const courseTitle = courseRes.rows[0]?.title || "Course";

      // ======================================================
      // 🔔 STORE NOTIFICATION
      // ======================================================
      try {
        await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, redirect_url, is_read, created_at)
          VALUES ($1, $2, $3, 'course', $4, $5, false, NOW())
          `,
          [
            user_id,
            "Enrollment Successful",
            `You enrolled in ${courseTitle}`,
            course_id,
            `/courses/${course_id}`
          ]
        );
      } catch (err) {
        console.error("❌ Notification insert failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Enrolled successfully",
        data: enrollment
      });
    }

    // =========================================================
    // PUT — Update progress
    // =========================================================
    if (req.method === "PUT") {

      const { course_id, progress } = req.body;

      if (!course_id || progress === undefined) {
        return res.status(400).json({
          success: false,
          message: "course_id and progress required"
        });
      }

      if (progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          message: "progress must be between 0 and 100"
        });
      }

      const completed = progress === 100;

      const result = await pool.query(
        `
        UPDATE "CourseEnrollment"
        SET progress = $1,
            completed = $2
        WHERE user_id = $3 AND course_id = $4
        RETURNING *
        `,
        [progress, completed, user_id, course_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Enrollment not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Progress updated",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Unenroll
    // =========================================================
    if (req.method === "DELETE") {

      const { course_id } = req.body;

      if (!course_id) {
        return res.status(400).json({
          success: false,
          message: "course_id required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "CourseEnrollment"
        WHERE user_id = $1 AND course_id = $2
        RETURNING *
        `,
        [user_id, course_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Enrollment not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Unenrolled successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("COURSE ENROLLMENT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}