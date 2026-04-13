import jwt from "jsonwebtoken";
import pool from "../../../lib/db";
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify as Google ID token (not Firebase)
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: [
        "710479367870-micu0jc76s5aqg2vfbu80k26b1k65mje.apps.googleusercontent.com",
        "710479367870-12ahpp9e9ugf5q7vu6v9hi16epqv5768.apps.googleusercontent.com",
      ],
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || "User";

    if (!email) {
      return res.status(400).json({ message: "Invalid token: email missing" });
    }

    // 🔍 Check if user exists
    const existing = await pool.query(
      `SELECT * FROM "User" WHERE email=$1`,
      [email]
    );

    let user;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
      if (user.auth_provider === "LOCAL") {
        return res.status(400).json({
          message: "Account exists with email/password. Use normal login.",
        });
      }
    } else {
      const result = await pool.query(
        `INSERT INTO "User"
         (full_name, email, password_hash, auth_provider, role_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
         RETURNING *`,
        [name, email, null, "GOOGLE", 4]
      );
      user = result.rows[0];
    }

    // ✅ Generate tokens
    const accessToken = jwt.sign(
      {
        user_id: user.user_id,
        role_id: user.role_id,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token: accessToken,
      data: { accessToken, refreshToken },
      user: {
        user_id: user.user_id,
        role_id: user.role_id,
        full_name: user.full_name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error("Google Login Error:", err.message);
    return res.status(500).json({
      message: "Authentication failed",
      error: err.message,
    });
  }
}