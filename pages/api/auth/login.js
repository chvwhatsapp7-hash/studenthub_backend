import bcrypt from "bcrypt";
import pool from "../../../lib/db";
import { cors } from "../../../lib/cors";
import { generateAccessToken, generateRefreshToken } from "../../../lib/jwt.js";
import cookie from "cookie";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const query = `
      SELECT user_id, role_id, full_name, password_hash
      FROM "User"
      WHERE email = $1
    `;
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ✅ Consistent payload — both tokens have all 3 fields
    const tokenPayload = {
      user_id:   user.user_id,
      role_id:   user.role_id,   // ✅ use 'role_id' everywhere
      full_name: user.full_name,
    };

    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload); // ✅ full_name included

    const isProd = process.env.NODE_ENV === "production";

    // ✅ Set cookies for web browser
    res.setHeader("Set-Cookie", [
      cookie.serialize("accessToken", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 15 * 60, // ✅ 15 min (match ACCESS_SECRET expiresIn)
      }),
      cookie.serialize("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      }),
    ]);

    // ✅ Return tokens in body for Flutter
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
}
