import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

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

    if (req.method === "GET") {

      // 🔒 Ensure school user only
      if (user.role_id !== 2) {
        return res.status(403).json({
          success: false,
          message: "Only school users allowed"
        });
      }

      // 🔹 USER BASIC
      const userQuery = `
        SELECT
          full_name,
          email,
          class,
          school_name,
          goal,
          about_me
        FROM "User"
        WHERE user_id = $1
      `;

      // 🔹 COURSES (WITH PROGRESS)
      const courseQuery = `
        SELECT
          c.course_id,
          c.title,
          ce.progress,
          ce.completed
        FROM "CourseEnrollment" ce
        JOIN "Course" c ON ce.course_id = c.course_id
        WHERE ce.user_id = $1
      `;

      // 🔹 INTERESTS
      const interestQuery = `
        SELECT i.name
        FROM "UserInterest" ui
        JOIN "Interest" i ON ui.interest_id = i.interest_id
        WHERE ui.user_id = $1
      `;

      // 🔹 ACHIEVEMENTS
      const achievementQuery = `
        SELECT
          a.title,
          a.icon
        FROM "UserAchievement" ua
        JOIN "Achievement" a ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = $1
      `;

      // 🔹 HACKATHONS (OPTIONAL)
      const hackathonQuery = `
        SELECT
          h.title,
          h.start_date,
          h.end_date
        FROM "HackathonParticipant" hp
        JOIN "Hackathon" h ON hp.hackathon_id = h.hackathon_id
        WHERE hp.user_id = $1
      `;

      // 🚀 Parallel queries
      const [
        userRes,
        courseRes,
        interestRes,
        achievementRes,
        hackathonRes
      ] = await Promise.all([
        pool.query(userQuery, [user_id]),
        pool.query(courseQuery, [user_id]),
        pool.query(interestQuery, [user_id]),
        pool.query(achievementQuery, [user_id]),
        pool.query(hackathonQuery, [user_id])
      ]);

      const userData = userRes.rows[0];

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const courses = courseRes.rows;
      const achievements = achievementRes.rows;

      // 📊 Stats (important for UI cards)
      const stats = {
        coursesEnrolled: courses.length,
        coursesCompleted: courses.filter(c => c.completed).length,
        achievements: achievements.length
      };

      return res.status(200).json({
        success: true,
        data: {
          user: userData,
          stats,
          courses,
          interests: interestRes.rows,
          achievements,
          hackathons: hackathonRes.rows
        }
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("SCHOOL PROFILE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}