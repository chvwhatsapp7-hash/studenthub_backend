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
    // POST — Create Course + Skills + Interests + PUBLIC Notification
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
        interest_ids,
        target_group
      } = req.body;

      const group =
        target_group && target_group.toLowerCase() === "school"
          ? "school"
          : "college";

      const notifyRoles = group === "school" ? [2] : [3,4];

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "title and description are required",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Insert Course
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

        // Link Skills
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

        // Link Interests
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

        // =====================================================
        // STORE PUBLIC NOTIFICATION (ROLE BASED)
        // =====================================================
        await client.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, category, entity_id, redirect_url, is_read, created_at)
          SELECT user_id,
                 $1,
                 $2,
                 'course_public',
                 'public',
                 $3,
                 $4,
                 false,
                 NOW()
          FROM "User"
          WHERE role_id = ANY($5::int[])
          `,
          [
            "New Course Available",
            `${title} course is now available`,
            course.course_id,
            `/courses/${course.course_id}`,
            notifyRoles
          ]
        );

        await client.query("COMMIT");
        client.release();

        try {
          await sendNotificationToAll(
            "New Course Available",
            `${title} course is now available`,
            notifyRoles
          );
        } catch (err) {
          console.error("Push failed:", err.message);
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
    // GET — Fetch Courses
    // =========================================================
    else if (req.method === "GET") {

      const { target_group } = req.query;

      const group =
        target_group && target_group.toLowerCase() === "school"
          ? "school"
          : "college";

      let query = "";
      let params = [];

      if (group === "school") {

        query = `
          SELECT
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
            c.target_group,
            c.status,
            c.created_at,
            c.updated_at,

            COALESCE(
              jsonb_agg(
                DISTINCT jsonb_build_object(
                  'skill_id', s.skill_id,
                  'name', s.name
                )
              ) FILTER (WHERE s.skill_id IS NOT NULL),
              '[]'::jsonb
            ) AS skills

          FROM "Course" c
          LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
          LEFT JOIN "Skill" s ON cs.skill_id = s.skill_id
          LEFT JOIN "CourseInterest" ci ON c.course_id = ci.course_id
          LEFT JOIN "UserInterest" ui ON ci.interest_id = ui.interest_id

          WHERE c.status = 1
          AND LOWER(c.target_group) = 'school'
          AND (
            ui.user_id = $1
            OR NOT EXISTS (
              SELECT 1 FROM "UserInterest" WHERE user_id = $1
            )
          )

          GROUP BY
            c.course_id,c.title,c.description,c.provider,c.instructor,
            c.category,c.level,c.duration,c.course_url,c.price,c.rating,
            c.target_group,c.status,c.created_at,c.updated_at

          ORDER BY c.created_at DESC
        `;

        params = [user_id];
      }

      else {

        query = `
          SELECT
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
            c.target_group,
            c.status,
            c.created_at,
            c.updated_at,

            COALESCE(
              jsonb_agg(
                DISTINCT jsonb_build_object(
                  'skill_id', s.skill_id,
                  'name', s.name
                )
              ) FILTER (WHERE s.skill_id IS NOT NULL),
              '[]'::jsonb
            ) AS skills

          FROM "Course" c
          LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
          LEFT JOIN "Skill" s ON cs.skill_id = s.skill_id

          WHERE c.status = 1
          AND LOWER(c.target_group) = 'college'

          GROUP BY
            c.course_id,c.title,c.description,c.provider,c.instructor,
            c.category,c.level,c.duration,c.course_url,c.price,c.rating,
            c.target_group,c.status,c.created_at,c.updated_at

          ORDER BY c.created_at DESC
        `;

        params = [];
      }

      const result = await pool.query(query, params);

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // PUT
    // =========================================================
    else if (req.method === "PUT") {

      const { course_id, title, duration, description, target_group } = req.body;

      const group = target_group ? target_group.toLowerCase() : null;

      const result = await pool.query(
        `
        UPDATE "Course"
        SET title = $1,
            duration = $2,
            description = $3,
            target_group = COALESCE($4, target_group),
            updated_at = NOW()
        WHERE course_id = $5
        RETURNING *
        `,
        [title, duration, description, group, course_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    // DELETE
    else if (req.method === "DELETE") {

      const { course_id } = req.body;

      const result = await pool.query(
        `DELETE FROM "Course" WHERE course_id = $1 RETURNING *`,
        [course_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    return res.status(405).json({
      success: false,
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