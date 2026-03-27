import pool from "../../lib/db";
import{cors} from "../../lib/cors";
import { authenticate } from "../../lib/auth";


export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
  
  if (cors(req, res)) return;

  try {

    // =========================
    // ✅ GET → Get Courses by user_id
    // =========================
    if (req.method === "GET") {

      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({
          message: "user_id is required"
        });
      }

      const query = `
        SELECT 
          c.course_id,
          c.title
        FROM "CourseEnrollment" ce
        JOIN "Course" c 
          ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
      `;

      const result = await pool.query(query, [user_id]);

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================
    // ✅ POST → Enroll
    // =========================
    if (req.method === "POST") {

      const { user_id, course_id } = req.body;

      if (!user_id || !course_id) {
        return res.status(400).json({
          message: "user_id and course_id are required"
        });
      }

      // Check already enrolled
      const check = await pool.query(
        `SELECT * FROM "CourseEnrollment"
         WHERE user_id = $1 AND course_id = $2`,
        [user_id, course_id]
      );

      if (check.rows.length > 0) {
        return res.status(409).json({
          message: "Already enrolled"
        });
      }

      // Insert
      const insertQuery = `
        INSERT INTO "CourseEnrollment"
        (user_id, course_id, enrollment_date)
        VALUES ($1,$2,NOW())
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        user_id,
        course_id
      ]);

      return res.status(201).json({
        success: true,
        message: "Enrolled successfully",
        data: result.rows[0]
      });
    }

    // =========================
    // ✅ DELETE → Unenroll
    // =========================
    if (req.method === "DELETE") {

      const { user_id, course_id } = req.body;

      if (!user_id || !course_id) {
        return res.status(400).json({
          message: "user_id and course_id required"
        });
      }

      const result = await pool.query(
        `DELETE FROM "CourseEnrollment"
         WHERE user_id = $1 AND course_id = $2
         RETURNING *`,
        [user_id, course_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Enrollment not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Unenrolled successfully"
      });
    }

    // =========================
    // ❌ Invalid Method
    // =========================
    return res.status(405).json({
      message: "Method not allowed"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      message: err.message
    });
  }
}
