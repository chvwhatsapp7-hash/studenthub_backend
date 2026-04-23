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

  const user_id = user.user_id;

  try {

    // =========================================================
    // POST — Create Course + Skills + Interests + Notification
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
        interest_ids,   // ✅ NEW
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

        // 🔹 Insert Course
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

        // 🔹 Link interests (NEW)
        if (Array.isArray(interest_ids) && interest_ids.length > 0) {

          const check = await client.query(
            `SELECT interest_id FROM "Interest" WHERE interest_id = ANY($1::int[])`,
            [interest_ids]
          );

          if (check.rows.length !== interest_ids.length) {
            throw new Error("Invalid interest_ids");
          }

          for (const interest_id of interest_ids) {
            await client.query(
              `
              INSERT INTO "CourseInterest" (course_id, interest_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
              `,
              [course.course_id, interest_id]
            );
          }
        }

        // 🔔 Notifications
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
    // GET — Fetch Courses (FILTERED BY USER INTERESTS)
    // =========================================================
    else if (req.method === "GET") {

      const { target_group } = req.query;

      const group = (target_group && target_group.toLowerCase() === "school")
        ? "school"
        : "college";

      const query = `
        SELECT DISTINCT c.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('skill_id', s.skill_id, 'name', s.name)
          ) FILTER (WHERE s.skill_id IS NOT NULL),
          '[]'
        ) AS skills
        FROM "Course" c
        LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
        LEFT JOIN "Skill" s ON cs.skill_id = s.skill_id

        LEFT JOIN "CourseInterest" ci ON c.course_id = ci.course_id
        LEFT JOIN "UserInterest" ui ON ci.interest_id = ui.interest_id

        WHERE c.status = 1
        AND LOWER(c.target_group) = $1
        AND (
          ui.user_id = $2
          OR NOT EXISTS (
            SELECT 1 FROM "UserInterest" WHERE user_id = $2
          )
        )

        GROUP BY c.course_id
        ORDER BY c.created_at DESC
      `;

      const result = await pool.query(query, [group, user_id]);

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