import bcrypt from "bcrypt";
import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {

    // =========================================================
    // POST — REGISTER USER (WITH SKILLS + INTERESTS)
    // =========================================================
    if (req.method === "POST") {

      const {
        full_name,
        email,
        password,

        phone = null,

        // 🎓 College
        university = null,
        degree = null,
        graduation_year = null,

        // 🏫 School
        class: userClass = null,
        school_name = null,

        // 🎯 Common
        goal = null,

        resume_url = null,
        linkedin_url = null,
        github_url = null,

        age,
        role_id,

        skills = [],         // [{skill_id, proficiency}]
        interest_ids = []    // [1,2,3]
      } = req.body;

      // ================= VALIDATION =================
      if (!full_name || !email || !password || age === undefined) {
        return res.status(400).json({
          success: false,
          message: "full_name, email, password, and age are required"
        });
      }

      // Skills validation
      if (skills.length > 0) {
        const isValid = skills.every(
          (s) =>
            typeof s.skill_id === "number" &&
            typeof s.proficiency === "number" &&
            s.proficiency >= 1 &&
            s.proficiency <= 5
        );
        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: "Invalid skills format"
          });
        }
      }

      // ================= EMAIL CHECK =================
      const emailCheck = await pool.query(
        `SELECT user_id FROM "User" WHERE email = $1`,
        [email]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already registered"
        });
      }

      // ================= ROLE CHECK =================
      const roleCheck = await pool.query(
        `SELECT role_id FROM "Role" WHERE role_id = $1`,
        [role_id]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid role_id"
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // ================= INSERT USER =================
        const userResult = await client.query(
          `
          INSERT INTO "User"
          (
            full_name, email, password_hash,
            phone,
            university, degree, graduation_year,
            class, school_name,
            goal,
            resume_url, linkedin_url, github_url,
            age, role_id,
            created_at, updated_at
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
          RETURNING user_id, full_name, email, role_id
          `,
          [
            full_name,
            email,
            hashedPassword,
            phone,
            university,
            degree,
            graduation_year,
            userClass,
            school_name,
            goal,
            resume_url,
            linkedin_url,
            github_url,
            age,
            role_id
          ]
        );

        const newUser = userResult.rows[0];

        // ================= INSERT SKILLS =================
        if (skills.length > 0) {
          const values = [];
          const placeholders = skills.map((s, i) => {
            const base = i * 3;
            values.push(newUser.user_id, s.skill_id, s.proficiency);
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          });

          await client.query(
            `
            INSERT INTO "UserSkill" (user_id, skill_id, proficiency)
            VALUES ${placeholders.join(", ")}
            ON CONFLICT (user_id, skill_id)
            DO UPDATE SET proficiency = EXCLUDED.proficiency
            `,
            values
          );
        }

        // ================= INSERT INTERESTS =================
        if (interest_ids.length > 0) {
          for (const interest_id of interest_ids) {
            await client.query(
              `
              INSERT INTO "UserInterest"(user_id, interest_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
              `,
              [newUser.user_id, interest_id]
            );
          }
        }

        await client.query("COMMIT");

        return res.status(201).json({
          success: true,
          message: "User created successfully",
          data: {
            ...newUser,
            skills_added: skills.length,
            interests_added: interest_ids.length
          }
        });

      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    }

    // =========================================================
    // GET — FETCH USER(S)
    // =========================================================
    if (req.method === "GET") {

      const { user_id } = req.query;

      if (user_id) {
        const result = await pool.query(
          `SELECT * FROM "User" WHERE user_id = $1`,
          [user_id]
        );
        return res.status(200).json(result.rows[0]);
      }

      const result = await pool.query(`SELECT * FROM "User"`);
      return res.status(200).json(result.rows);
    }

    // =========================================================
    // PUT — UPDATE USER
    // =========================================================
    if (req.method === "PUT") {

      const {
        user_id,
        full_name,
        phone,
        university,
        class: userClass,
        school_name,
        goal,
        about_me
      } = req.body;

      if (!user_id) {
        return res.status(400).json({ message: "user_id required" });
      }

      const result = await pool.query(
        `
        UPDATE "User"
        SET
          full_name = COALESCE($1, full_name),
          phone = COALESCE($2, phone),
          university = COALESCE($3, university),
          class = COALESCE($4, class),
          school_name = COALESCE($5, school_name),
          goal = COALESCE($6, goal),
          about_me = COALESCE($7, about_me),
          updated_at = NOW()
        WHERE user_id = $8
        RETURNING *
        `,
        [
          full_name,
          phone,
          university,
          userClass,
          school_name,
          goal,
          about_me,
          user_id
        ]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — REMOVE USER
    // =========================================================
    if (req.method === "DELETE") {

      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ message: "user_id required" });
      }

      await pool.query(
        `DELETE FROM "User" WHERE user_id = $1`,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        message: "User deleted"
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error("USER API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}