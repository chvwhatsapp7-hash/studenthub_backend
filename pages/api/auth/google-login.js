import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import pool from "../../../lib/db";
//import serviceAccount from "../../../lib/internship-frontend-firebase-adminsdk-fbsvc-2f5d720038.json";

// 🔐 Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

export default async function handler(req, res) {
  try {
    // ✅ Only POST
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    // 🔐 Extract token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(token);

    const email = decoded.email;
    const name = decoded.name || "User";

    if (!email) {
      return res.status(400).json({
        message: "Invalid token: email missing",
      });
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
      const DEFAULT_ROLE = 4;

      const result = await pool.query(
        `INSERT INTO "User"
         (full_name, email, password_hash, auth_provider, role_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
         RETURNING *`,
        [name, email, null, "GOOGLE", DEFAULT_ROLE]
      );

      user = result.rows[0];
    }

    // ✅ Generate Access Token (short-lived)
    const accessToken = jwt.sign(
      {
        user_id: user.user_id,      // ✅ FIXED: was 'userId', Flutter reads 'user_id'
        role_id: user.role_id,
        full_name: user.full_name,  // ✅ ADDED: Flutter needs full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }          // ✅ FIXED: short-lived like email login
    );

    // ✅ Generate Refresh Token (long-lived)
    const refreshToken = jwt.sign(
      {
        user_id: user.user_id,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token: accessToken,           // Flutter reads data["token"]
      data: {
        accessToken,                // ✅ consistent with email login shape
        refreshToken,
      },
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