import pool from "../../lib/db";

export default async function handler(req, res) {

  try {

    if (req.method === "POST") {

      const { user_id, course_id } = req.body;

      if (!user_id || !course_id) {
        return res.status(400).json({
          message: "user_id and course_id are required"
        });
      }

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

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });
  }
}