import pool from "../../lib/db";
import cors from "../../lib/cors";

export default async function handler(req, res) {
  if(cors(req, res)) return;
  try {

    // ───────────── POST ─────────────
    if (req.method === "POST") {
      const { user_id, title, issuer, issue_date, file_url } = req.body;

      if (!user_id || !title || !issuer) {
        return res.status(400).json({
          message: "user_id, title, issuer are required"
        });
      }

      const result = await pool.query(
        `INSERT INTO "Certificate"
         (user_id, title, issuer, issue_date, file_url, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         RETURNING *`,
        [user_id, title, issuer, issue_date || null, file_url||null]
      );

      return res.status(201).json({
        success: true,
        message: "Certificate added successfully",
        data: result.rows[0]
      });
    }

    // ───────────── DELETE ─────────────
    if (req.method === "DELETE") {
      const { certificate_id } = req.body;

      if (!certificate_id) {
        return res.status(400).json({
          message: "certificate_id is required"
        });
      }

      const result = await pool.query(
        `DELETE FROM "Certificate"
         WHERE certificate_id = $1
         RETURNING *`,
        [certificate_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Certificate not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Certificate deleted successfully"
      });
    }

    // ───────────── GET ─────────────
    if (req.method === "GET") {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({
          message: "user_id is required"
        });
      }

      const result = await pool.query(
        `SELECT * FROM "Certificate" 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // ───────────── Method Not Allowed ─────────────
    return res.status(405).json({
      message: "Method not allowed"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: err.message
    });
  }
}
