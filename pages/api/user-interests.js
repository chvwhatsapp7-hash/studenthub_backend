import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ CORS
  if (cors(req, res)) return;

  // ✅ AUTH
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = user.user_id;

  try {

    // =========================================================
    // GET — Fetch user interests
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT 
          i.interest_id,
          i.name
        FROM "UserInterest" ui
        JOIN "Interest" i ON ui.interest_id = i.interest_id
        WHERE ui.user_id = $1
        ORDER BY i.name
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Set / Update interests (replace all)
    // =========================================================
    if (req.method === "POST") {

      const { interest_ids } = req.body;

      if (!Array.isArray(interest_ids)) {
        return res.status(400).json({
          success: false,
          message: "interest_ids must be an array"
        });
      }

      // 🔍 Validate interest_ids
      if (interest_ids.length > 0) {
        const check = await pool.query(
          `SELECT interest_id FROM "Interest" WHERE interest_id = ANY($1::int[])`,
          [interest_ids]
        );

        if (check.rows.length !== interest_ids.length) {
          return res.status(400).json({
            success: false,
            message: "Invalid interest_ids"
          });
        }
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 🔹 Remove old interests
        await client.query(
          `DELETE FROM "UserInterest" WHERE user_id = $1`,
          [user_id]
        );

        // 🔹 Insert new interests
        for (const interest_id of interest_ids) {
          await client.query(
            `
            INSERT INTO "UserInterest" (user_id, interest_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [user_id, interest_id]
          );
        }

        await client.query("COMMIT");
        client.release();

        return res.status(200).json({
          success: true,
          message: "Interests updated successfully"
        });

      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("USER INTERESTS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}