import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotificationToAll } from "../../lib/sendNotificationToAll";

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
    // POST — Create Course + Notification
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

      let group = "college";

      if (target_group && target_group.toLowerCase() === "school") {
        group = "school";
      }

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "title and description are required",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

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

        // 🔹 Link skills
        if (Array.isArray(skill_ids) && skill_ids.length > 0) {
          for (const skill_id of skill_ids) {
            await client.query(
              `
              INSERT INTO "CourseSkill" (course_id, skill_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
              `,
              [course.course_id, skill_id]
            );
          }
        }

        // =====================================================
        // 🔔 STORE NOTIFICATION (FULL MODEL SUPPORT)
        // =====================================================
        const notifResult = await client.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, redirect_url, is_read, created_at)
          SELECT user_id,
                 $1,
                 $2,
                 'course',
                 $3,
                 $4,
                 false,
                 NOW()
          FROM "User"
          RETURNING notification_id
          `,
          [
            "New Course Available",
            `${title} course is now available`,
            course.course_id,
            `/courses/${course.course_id}`
          ]
        );

        console.log("✅ Course notifications inserted:", notifResult.rowCount);

        await client.query("COMMIT");
        client.release();

        // =====================================================
        // 🔥 PUSH NOTIFICATION (SAFE)
        // =====================================================
        try {
          await sendNotificationToAll(
            "New Course Available",
            `${title} course is now available`
          );
        } catch (err) {
          console.error("❌ Push failed:", err.message);
        }

        return res.status(201).json({
          success: true,
          message: "Course created successfully",
          data: course,
        });

      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    // =========================================================
    // GET — Fetch Courses (UNCHANGED)
    // =========================================================
    else if (req.method === "GET") {

      const { target_group } = req.query;

      let query = "";

      if (target_group && target_group.toLowerCase() === "school") {
        query = `
          SELECT c.*,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('skill_id', s.skill_id, 'name', s.name)
            ) FILTER (WHERE s.skill_id IS NOT NULL),
            '[]'
          ) AS skills
          FROM "Course" c
          LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
          LEFT JOIN "Skill" s ON cs.skill_id = s.skill_id
          WHERE c.status = 1
          AND LOWER(c.target_group) = 'school'
          GROUP BY c.course_id
          ORDER BY c.created_at DESC
        `;
      } else {
        query = `
          SELECT c.*,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('skill_id', s.skill_id, 'name', s.name)
            ) FILTER (WHERE s.skill_id IS NOT NULL),
            '[]'
          ) AS skills
          FROM "Course" c
          LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
          LEFT JOIN "Skill" s ON cs.skill_id = s.skill_id
          WHERE c.status = 1
          AND LOWER(c.target_group) = 'college'
          GROUP BY c.course_id
          ORDER BY c.created_at DESC
        `;
      }

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // =========================================================
    // PUT
    // =========================================================
    else if (req.method === "PUT") {

      const {
        course_id,
        title,
        duration,
        description,
        target_group
      } = req.body;

      const group = target_group
        ? target_group.toLowerCase()
        : null;

      const result = await pool.query(
        `
        UPDATE "Course"
        SET title=$1,
            duration=$2,
            description=$3,
            target_group=COALESCE($4, target_group),
            updated_at = NOW()
        WHERE course_id=$5
        RETURNING *
        `,
        [title, duration, description, group, course_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE
    // =========================================================
    else if (req.method === "DELETE") {

      const { course_id } = req.body;

      const result = await pool.query(
        `DELETE FROM "Course" WHERE course_id=$1 RETURNING *`,
        [course_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error("COURSE API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}