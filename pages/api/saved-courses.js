import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = req.query.user_id || req.body.user_id || user.user_id;

  try {

    // =========================================================
    // GET — Fetch all saved courses of user
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT
          sc.saved_id,
          sc.saved_at,
          c.course_id,
          c.title,
          c.description,
          c.provider,
          c.instructor,
          c.category,
          c.level,
          c.duration,
          c.course_url,
          c.price,
          c.rating,
          c.target_group
        FROM "SavedCourse" sc
        JOIN "Course" c ON sc.course_id = c.course_id
        WHERE sc.user_id = $1
        ORDER BY sc.saved_at DESC
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Save a course + Personal Notification
    // =========================================================
    if (req.method === "POST") {

      const { course_id } = req.body;

      if (!course_id) {
        return res.status(400).json({
          success: false,
          message: "course_id is required"
        });
      }

      const check = await pool.query(
        `
        SELECT 1 FROM "SavedCourse"
        WHERE user_id = $1 AND course_id = $2
        `,
        [user_id, course_id]
      );

      if (check.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Course already saved"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "SavedCourse" (user_id, course_id, saved_at)
        VALUES ($1, $2, NOW())
        RETURNING *
        `,
        [user_id, course_id]
      );

      // Get course title
      const courseRes = await pool.query(
        `SELECT title FROM "Course" WHERE course_id = $1`,
        [course_id]
      );

      const courseTitle = courseRes.rows[0]?.title || "Course";

      // ======================================================
      // STORE PERSONAL NOTIFICATION
      // ======================================================
      try {
        await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, category, entity_id, redirect_url, is_read, created_at)
          VALUES ($1, $2, $3, 'course_saved', 'personal', $4, $5, false, NOW())
          `,
          [
            user_id,
            "Course Saved",
            `${courseTitle} was added to your saved courses`,
            course_id,
            `/courses/${course_id}`
          ]
        );
      } catch (err) {
        console.error("Notification insert failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Course saved successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Unsave a course
    // =========================================================
    if (req.method === "DELETE") {

      const { course_id } = req.body;

      if (!course_id) {
        return res.status(400).json({
          success: false,
          message: "course_id is required"
        });
      }

      await pool.query(
        `
        DELETE FROM "SavedCourse"
        WHERE user_id = $1 AND course_id = $2
        `,
        [user_id, course_id]
      );

      return res.status(200).json({
        success: true,
        message: "Course unsaved successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("SAVED COURSES ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}