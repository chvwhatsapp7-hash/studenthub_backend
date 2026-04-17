import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";
import { generateAccessToken, generateRefreshToken } from "../../../lib/jwt.js";
import { OAuth2Client } from 'google-auth-library';
import cookie from "cookie";

const client = new OAuth2Client();

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: [
        "710479367870-micu0jc76s5aqg2vfbu80k26b1k65mje.apps.googleusercontent.com",
        "710479367870-12ahpp9e9ugf5q7vu6v9hi16epqv5768.apps.googleusercontent.com",
        "710479367870-k5l0ksoadstbmkgrp6ffhlmon7jptjtl.apps.googleusercontent.com",
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

      // ⚠️ Prevent LOCAL account conflict
      if (user.auth_provider === "LOCAL") {
        return res.status(400).json({
          message: "Account exists with email/password. Use normal login.",
        });
      }
    } else {
      // ✅ Create new Google user
      const result = await pool.query(
        `INSERT INTO "User"
         (full_name, email, password_hash, auth_provider, role_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
         RETURNING *`,
        [name, email, null, "GOOGLE", 0]
      );
      user = result.rows[0];
    }

    // ✅ Same payload structure as email login
    const tokenPayload = {
      user_id:   user.user_id,
      role_id:   user.role_id,
      full_name: user.full_name,
    };

    // ✅ Use same generators as email login
    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const isProd = process.env.NODE_ENV === "production";

    // ✅ Set cookies (same as email login)
    res.setHeader("Set-Cookie", [
      cookie.serialize("accessToken", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 15 * 60,
      }),
      cookie.serialize("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      }),
    ]);

    // ✅ Return tokens in body for Flutter (same as email login)
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken,
      data: {
        accessToken,
        refreshToken,
      },
      user: {
        user_id:   user.user_id,
        role_id:   user.role_id,
        full_name: user.full_name,
        email:     user.email,
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