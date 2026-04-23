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

  try {

    // =========================================================
    // GET — Fetch course-interest mappings
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(`
        SELECT 
          ci.id,
          ci.course_id,
          c.title AS course_title,
          ci.interest_id,
          i.name AS interest_name
        FROM "CourseInterest" ci
        JOIN "Course" c ON ci.course_id = c.course_id
        JOIN "Interest" i ON ci.interest_id = i.interest_id
        ORDER BY ci.id DESC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Add mapping
    // =========================================================
    if (req.method === "POST") {

      const { course_id, interest_id } = req.body;

      if (!course_id || !interest_id) {
        return res.status(400).json({
          success: false,
          message: "course_id and interest_id are required"
        });
      }

      // 🔍 Validate course
      const courseCheck = await pool.query(
        `SELECT 1 FROM "Course" WHERE course_id = $1`,
        [course_id]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid course_id"
        });
      }

      // 🔍 Validate interest
      const interestCheck = await pool.query(
        `SELECT 1 FROM "Interest" WHERE interest_id = $1`,
        [interest_id]
      );

      if (interestCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid interest_id"
        });
      }

      // 🔍 Prevent duplicates
      const duplicate = await pool.query(
        `
        SELECT 1 FROM "CourseInterest"
        WHERE course_id = $1 AND interest_id = $2
        `,
        [course_id, interest_id]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Mapping already exists"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "CourseInterest"
        (course_id, interest_id)
        VALUES ($1, $2)
        RETURNING *
        `,
        [course_id, interest_id]
      );

      return res.status(201).json({
        success: true,
        message: "Mapping added successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Remove mapping
    // =========================================================
    if (req.method === "DELETE") {

      const { course_id, interest_id } = req.body;

      if (!course_id || !interest_id) {
        return res.status(400).json({
          success: false,
          message: "course_id and interest_id required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "CourseInterest"
        WHERE course_id = $1 AND interest_id = $2
        RETURNING *
        `,
        [course_id, interest_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Mapping not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Mapping removed successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("COURSE INTEREST API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}