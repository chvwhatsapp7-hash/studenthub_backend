import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

// ❗ IMPORTANT: KEEP THIS COMMENTED unless file exists
// import { sendNotification } from "../../lib/sendNotifications";

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
    // GET — Get enrolled courses
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT 
          c.course_id,
          c.title
        FROM "CourseEnrollment" ce
        JOIN "Course" c 
          ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Enroll + Notification
    // =========================================================
    if (req.method === "POST") {

      const { course_id } = req.body;

      if (!course_id) {
        return res.status(400).json({
          success: false,
          message: "course_id is required"
        });
      }

      // 🔍 Check duplicate
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

      // 🔹 Insert enrollment
      const insert = await pool.query(
        `
        INSERT INTO "CourseEnrollment"
        (user_id, course_id, enrollment_date)
        VALUES ($1,$2,NOW())
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
      // 🔔 STORE NOTIFICATION (SINGLE USER)
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

      // ======================================================
      // 🔥 PUSH NOTIFICATION (SAFE — OPTIONAL)
      // ======================================================
      try {
        // ❗ Only enable if file exists
        // await sendNotification(
        //   user_id,
        //   "Enrollment Successful",
        //   `You enrolled in ${courseTitle}`
        // );
      } catch (err) {
        console.error("❌ Push failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Enrolled successfully",
        data: enrollment
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