import { pool } from "../../lib/database";
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
    // ✅ POST — Create Course
    // =========================================================
    if (req.method === "POST") {

      const {
        title,
        description,
        provider,
        instructor,
        category,
        level,
        duration,
        course_url,
        price,
        rating,
        skill_ids,
        target_group
      } = req.body;

      const group = target_group || "college";

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "title and description are required",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 🔹 Insert course
        const courseResult = await client.query(
          `
          INSERT INTO "Course"
          (title, description, provider, instructor, category, level, duration, course_url, price, rating, target_group, created_at, updated_at)
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
          RETURNING *
          `,
          [
            title,
            description,
            provider,
            instructor,
            category,
            level,
            duration,
            course_url,
            price,
            rating,
            group
          ]
        );

        const course = courseResult.rows[0];
        const course_id = course.course_id;

        const linkedSkills = [];

        // 🔹 Link skills (SAFE VERSION)
        if (Array.isArray(skill_ids) && skill_ids.length > 0) {
          for (const skill_id of skill_ids) {
            await client.query(
              `
              INSERT INTO "CourseSkill" (course_id, skill_id)
              VALUES ($1, $2)
              ON CONFLICT (course_id, skill_id) DO NOTHING
              `,
              [course_id, skill_id]
            );
          }
        }

        await client.query("COMMIT");
        client.release();

        return res.status(201).json({
          success: true,
          message: "Course created successfully",
          data: {
            ...course,
            skills: linkedSkills,
          },
        });

      } catch (txErr) {
        await client.query("ROLLBACK");
        client.release();
        console.error("TX ERROR:", txErr);
        throw txErr;
      }
    }

    // =========================================================
    // ✅ GET — Fetch Courses (FILTERED)
    // =========================================================
    else if (req.method === "GET") {

      const { target_group } = req.query;
      const group = target_group || "college";

      const result = await pool.query(
        `
        SELECT
          c.*,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('skill_id', s.skill_id, 'name', s.name)
            ) FILTER (WHERE s.skill_id IS NOT NULL),
            '[]'
          ) AS skills
        FROM "Course" c
        LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
        LEFT JOIN "Skill" s        ON cs.skill_id  = s.skill_id
        WHERE c.status = 1
        AND c.target_group = $1
        GROUP BY c.course_id
        ORDER BY c.created_at DESC
        `,
        [group]
      );

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // =========================================================
    // ✅ PUT — Update Course
    // =========================================================
    else if (req.method === "PUT") {

      const {
        course_id,
        title,
        duration,
        description,
        target_group
      } = req.body;

      const result = await pool.query(
        `
        UPDATE "Course"
        SET title=$1,
            duration=$2,
            description=$3,
            target_group=$4,
            updated_at = NOW()
        WHERE course_id=$5
        RETURNING *
        `,
        [title, duration, description, target_group, course_id]
      );

      return res.status(200).json({
        success: true,
        message: "Course updated successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // ✅ DELETE — Remove Course
    // =========================================================
    else if (req.method === "DELETE") {

      const { course_id } = req.body;

      const result = await pool.query(
        `DELETE FROM "Course" WHERE course_id=$1 RETURNING *`,
        [course_id]
      );

      return res.status(200).json({
        success: true,
        message: "Course deleted successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // ❌ METHOD NOT ALLOWED
    // =========================================================
    return res.status(405).json({
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("COURSE API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}