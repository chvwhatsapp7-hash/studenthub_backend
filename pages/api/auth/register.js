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
      github_url
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO "User"
      (full_name,email,password_hash,phone,university,degree,graduation_year,resume_url,linkedin_url,github_url,role_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
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
      1
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });

  }

}