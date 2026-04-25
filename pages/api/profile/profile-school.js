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

  // ✅ manual support + token fallback
  const user_id = req.query.user_id || req.body.user_id || user.user_id;

  try {

    if (req.method === "GET") {

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

      // 🔹 ENROLLED COURSES
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

      // 🔹 SAVED COURSES ✅ NEW
      const savedCourseQuery = `
        SELECT
          c.course_id,
          c.title,
          c.description,
          sc.saved_at
        FROM "SavedCourse" sc
        JOIN "Course" c ON sc.course_id = c.course_id
        WHERE sc.user_id = $1
        ORDER BY sc.saved_at DESC
      `;

      // 🔹 INTERESTS
      const interestQuery = `
        SELECT i.interest_id, i.name
        FROM "UserInterest" ui
        JOIN "Interest" i ON ui.interest_id = i.interest_id
        WHERE ui.user_id = $1
      `;

      // 🔹 ACHIEVEMENTS
      const achievementQuery = `
        SELECT
          a.achievement_id,
          a.title,
          a.icon
        FROM "UserAchievement" ua
        JOIN "Achievement" a ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = $1
      `;

      // 🚀 Parallel Queries
      const [
        userRes,
        courseRes,
        savedCourseRes,
        interestRes,
        achievementRes
      ] = await Promise.all([
        pool.query(userQuery, [user_id]),
        pool.query(courseQuery, [user_id]),
        pool.query(savedCourseQuery, [user_id]),
        pool.query(interestQuery, [user_id]),
        pool.query(achievementQuery, [user_id])
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
      const savedCourses = savedCourseRes.rows;

      // 🔹 STATS
      const stats = {
        coursesEnrolled: courses.length,
        coursesCompleted: courses.filter(c => c.completed).length,
        savedCourses: savedCourses.length,
        achievements: achievements.length
      };

      return res.status(200).json({
        success: true,
        data: {
          user: userData,
          stats,
          courses,
          savedCourses,
          interests: interestRes.rows,
          achievements
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