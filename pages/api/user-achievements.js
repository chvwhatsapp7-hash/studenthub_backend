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

  const user_id = user.user_id;

  try {

    // =========================================================
    // GET — Fetch user achievements
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT
          a.achievement_id,
          a.title,
          a.description,
          a.icon,
          ua.achieved_at
        FROM "UserAchievement" ua
        JOIN "Achievement" a 
          ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = $1
        ORDER BY ua.achieved_at DESC
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Evaluate & Assign Achievements (AUTO)
    // =========================================================
    if (req.method === "POST") {

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // ===============================
        // 1️⃣ Count user activities
        // ===============================

        const interestCountRes = await client.query(
          `SELECT COUNT(*) FROM "UserInterest" WHERE user_id = $1`,
          [user_id]
        );

        const courseCountRes = await client.query(
          `SELECT COUNT(*) FROM "CourseEnrollment" WHERE user_id = $1`,
          [user_id]
        );

        const interestCount = parseInt(interestCountRes.rows[0].count);
        const courseCount = parseInt(courseCountRes.rows[0].count);

        // ===============================
        // 2️⃣ Define achievement rules
        // ===============================

        const rules = [];

        // 🎯 Interest-based
        if (interestCount >= 1) rules.push("Curious Mind");
        if (interestCount >= 3) rules.push("Explorer");
        if (interestCount >= 5) rules.push("All-Rounder");

        // 🎓 Course-based
        if (courseCount >= 1) rules.push("First Step");
        if (courseCount >= 3) rules.push("Learning Streak");
        if (courseCount >= 5) rules.push("Knowledge Seeker");

        // ===============================
        // 3️⃣ Fetch matching achievements
        // ===============================

        if (rules.length === 0) {
          await client.query("COMMIT");
          client.release();

          return res.status(200).json({
            success: true,
            message: "No achievements to assign"
          });
        }

        const achievementRes = await client.query(
          `
          SELECT achievement_id, title
          FROM "Achievement"
          WHERE title = ANY($1::text[])
          `,
          [rules]
        );

        const achievements = achievementRes.rows;

        // ===============================
        // 4️⃣ Insert new achievements (avoid duplicates)
        // ===============================

        let newlyAssigned = [];

        for (const a of achievements) {

          const exists = await client.query(
            `
            SELECT 1 FROM "UserAchievement"
            WHERE user_id = $1 AND achievement_id = $2
            `,
            [user_id, a.achievement_id]
          );

          if (exists.rows.length === 0) {

            await client.query(
              `
              INSERT INTO "UserAchievement"
              (user_id, achievement_id, achieved_at)
              VALUES ($1, $2, NOW())
              `,
              [user_id, a.achievement_id]
            );

            newlyAssigned.push(a.title);
          }
        }

        await client.query("COMMIT");
        client.release();

        return res.status(200).json({
          success: true,
          message: "Achievements evaluated",
          new_achievements: newlyAssigned
        });

      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("USER ACHIEVEMENTS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}