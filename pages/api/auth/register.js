import bcrypt from "bcrypt";
import pool from "../../../lib/db";
import{cors} from "../../../lib/cors";

export default async function handler(req, res) {
    if (cors(req, res)) return;

  try {

    // ─────────────────────────────────────────
    // POST — Register a new user (with optional skills)
    // ─────────────────────────────────────────
    if (req.method === "POST") {
      const {
        full_name,
        email,
        password,
        phone = null,
        university = null,
        degree = null,
        graduation_year = null,
        resume_url = null,
        linkedin_url = null,
        github_url = null,
        age,
        role_id,
        skills = []  // array of { skill_id: number, proficiency: number }
      } = req.body;

      // Required field check
      if (!full_name || !email || !password || age === undefined) {
        return res.status(400).json({
          success: false,
          message: "full_name, email, password, and age are required"
        });
      }

      // Validate skills shape if provided
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
            message: "Each skill must have a numeric skill_id and proficiency (1–5)"
          });
        }
      }

      // Check if email already exists
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

      // Validate role_id
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

      // Use a transaction so user + skills are inserted atomically
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Insert user
        const userResult = await client.query(
          `INSERT INTO "User"
            (full_name, email, password_hash, phone, university, degree,
             graduation_year, resume_url, linkedin_url, github_url, age, role_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
           RETURNING user_id, full_name, email, role_id`,
          [
            full_name,
            email,
            hashedPassword,
            phone,
            university,
            degree,
            graduation_year,
            resume_url,
            linkedin_url,
            github_url,
            age,
            role_id
          ]
        );

        const newUser = userResult.rows[0];

        // 2. Insert skills if provided
        if (skills.length > 0) {
          // Verify all provided skill_ids exist in Skill table
          const skillIds = skills.map((s) => s.skill_id);
          const skillCheck = await client.query(
            `SELECT skill_id FROM "Skill" WHERE skill_id = ANY($1::int[])`,
            [skillIds]
          );

          if (skillCheck.rows.length !== skillIds.length) {
            throw new Error("One or more skill_ids are invalid");
          }

          // Build bulk parameterized insert
          const values = [];
          const placeholders = skills.map((s, i) => {
            const base = i * 3;
            values.push(newUser.user_id, s.skill_id, s.proficiency);
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          });

          await client.query(
            `INSERT INTO "UserSkill" (user_id, skill_id, proficiency)
             VALUES ${placeholders.join(", ")}
             ON CONFLICT (user_id, skill_id) DO UPDATE SET proficiency = EXCLUDED.proficiency`,
            values
          );
        }

        await client.query("COMMIT");

        return res.status(201).json({
          success: true,
          message: "User created successfully",
          data: {
            ...newUser,
            skills_added: skills.length
          }
        });

      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    }

    // ─────────────────────────────────────────
    // GET — Fetch all users or single user by user_id
    // ─────────────────────────────────────────
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

    // ─────────────────────────────────────────
    // PUT — Update user fields
    // ─────────────────────────────────────────
    if (req.method === "PUT") {
      const { user_id, full_name, phone, university } = req.body;

      if (!user_id) {
        return res.status(400).json({ message: "user_id required" });
      }

      const result = await pool.query(
        `UPDATE "User"
         SET full_name = COALESCE($1, full_name),
             phone = COALESCE($2, phone),
             university = COALESCE($3, university),
             updated_at = NOW()
         WHERE user_id = $4
         RETURNING *`,
        [full_name, phone, university, user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows[0]
      });
    }

    // ─────────────────────────────────────────
    // DELETE — Remove a user
    // ─────────────────────────────────────────
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
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
