import bcrypt from "bcrypt";
import pool from "../../../lib/db";

export default async function handler(req, res) {

  // ✅ Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    // ✅ Destructure request body
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
      role_id// default role
    } = req.body;

    // ✅ Validation
    if (!full_name || !email || !password || age === undefined) {
      return res.status(400).json({
        success: false,
        message: "full_name, email, password, and age are required"
      });
    }

    // ✅ Check if email already exists
    const emailCheck = await pool.query(
      `SELECT * FROM "User" WHERE email = $1`,
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // ✅ Check if role exists (VERY IMPORTANT)
    const roleCheck = await pool.query(
  `SELECT * FROM "Role" WHERE role_id = $1`,
  [role_id]
);

    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid role_id"
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Insert user
    const query = `
      INSERT INTO "User"
      (
        full_name,
        email,
        password_hash,
        phone,
        university,
        degree,
        graduation_year,
        resume_url,
        linkedin_url,
        github_url,
        age,
        role_id,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()
      )
      RETURNING user_id, full_name, email, role_id, created_at
    `;

    const values = [
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
    ];

    const result = await pool.query(query, values);

    // ✅ Success response
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message
    });
  }
}
