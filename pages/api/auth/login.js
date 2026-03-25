import bcrypt from "bcrypt";
import pool from "../../../lib/db";
import{cors} from "../../../lib/cors";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // ✅ Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {

    const { email, password } = req.body;

    // ✅ Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // ✅ Get user
    const query = `
      SELECT user_id,role_id,full_name,password_hash
      FROM "User"
      WHERE email = $1
    `;

    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // ✅ Success response (ONLY required fields)
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user_id: user.user_id,
        role_id: user.role_id
      }
    });

  } catch (err) {

    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message
    });

  }
}
