import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  if (cors(req, res)) return;

  try {

    // =========================================================
    // GET — All interests (+ optional selected flag)
    // =========================================================
    if (req.method === "GET") {

      let user = null;
      let user_id = null;

      // 🔹 Try to authenticate (optional)
      try {
        user = authenticate(req, res);
        user_id = user?.user_id;
      } catch {
        // ignore auth errors for public access
      }

      let result;

      if (user_id) {
        // ✅ Return with selected flag
        result = await pool.query(
          `
          SELECT 
            i.interest_id,
            i.name,
            CASE 
              WHEN ui.user_id IS NOT NULL THEN true
              ELSE false
            END AS selected
          FROM "Interest" i
          LEFT JOIN "UserInterest" ui
            ON i.interest_id = ui.interest_id
            AND ui.user_id = $1
          ORDER BY i.name
          `,
          [user_id]
        );
      } else {
        // ✅ Public (no selected flag)
        result = await pool.query(
          `SELECT interest_id, name FROM "Interest" ORDER BY name`
        );
      }

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Add new interest (ADMIN USE)
    // =========================================================
    if (req.method === "POST") {

      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "name is required"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "Interest" (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
        RETURNING *
        `,
        [name]
      );

      return res.status(201).json({
        success: true,
        message: "Interest created",
        data: result.rows[0] || null
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("INTEREST MASTER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}