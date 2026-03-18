import bcrypt from "bcrypt";
import pool from "../../../lib/db";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {

    const {
      full_name,
      email,
      password,
      phone,
      university,
      degree,
      graduation_year,
      resume_url,
      linkedin_url,
      github_url,
      age   // 👈 ADD THIS
    } = req.body;

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🎯 Decide user type
    let user_type;

    if (age < 18) {
      user_type = "junior";
    } else {
      user_type = "senior";
    }

    const query = `
      INSERT INTO "User"
      (full_name,email,password_hash,phone,university,degree,graduation_year,resume_url,linkedin_url,github_url,age,user_type,role_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
      RETURNING *
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
      user_type,  // 👈 ADD THIS
      1           // student role
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user_type: user_type,
      data: result.rows[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });

  }

}