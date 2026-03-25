import { pool } from "../../lib/database";
import {cors} from "../../lib/cors";

export default async function handler(req, res) {

  if (cors(req, res)) return;

  try {


    if (req.method === "POST") {

      const { course_id, skill_id } = req.body;

      // 🔍 Validation
      if (!course_id || !skill_id) {
        return res.status(400).json({
          success: false,
          message: "course_id and skill_id are required"
        });
      }

      // 🔍 Check if course exists
      const courseCheck = await pool.query(
        `SELECT * FROM "Course" WHERE course_id = $1`,
        [course_id]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid course_id"
        });
      }

      // 🔍 Check if skill exists
      const skillCheck = await pool.query(
        `SELECT * FROM "Skill" WHERE skill_id = $1`,
        [skill_id]
      );

      if (skillCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid skill_id"
        });
      }

      // 🔍 Prevent duplicate
      const exists = await pool.query(
        `SELECT * FROM "CourseSkill" WHERE course_id = $1 AND skill_id = $2`,
        [course_id, skill_id]
      );

      if (exists.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Skill already added to this course"
        });
      }

      // ✅ Insert
      const result = await pool.query(
        `
        INSERT INTO "CourseSkill" (course_id, skill_id)
        VALUES ($1, $2)
        RETURNING *
        `,
        [course_id, skill_id]
      );

      return res.status(201).json({
        success: true,
        message: "Skill added to course",
        data: result.rows[0]
      });
    }

    // ===========================
    // DELETE → Remove skill
    // ===========================
    if (req.method === "DELETE") {

      const { course_id, skill_id } = req.body;

      if (!course_id || !skill_id) {
        return res.status(400).json({
          success: false,
          message: "course_id and skill_id are required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "CourseSkill"
        WHERE course_id = $1 AND skill_id = $2
        RETURNING *
        `,
        [course_id, skill_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Mapping not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Skill removed from course",
        data: result.rows[0]
      });
    }

    // ===========================
    // INVALID METHOD
    // ===========================
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