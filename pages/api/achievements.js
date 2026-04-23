import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ CORS
  if (cors(req, res)) return;

  // ✅ AUTH (you can later restrict to admin)
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {

    // =========================================================
    // GET — Fetch all achievements
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `
        SELECT 
          achievement_id,
          title,
          description,
          icon
        FROM "Achievement"
        ORDER BY achievement_id DESC
        `
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Create achievement
    // =========================================================
    if (req.method === "POST") {

      const { title, description, icon } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "title and description are required"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "Achievement"
        (title, description, icon)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [title, description, icon || null]
      );

      return res.status(201).json({
        success: true,
        message: "Achievement created successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // PUT — Update achievement
    // =========================================================
    if (req.method === "PUT") {

      const { achievement_id, title, description, icon } = req.body;

      if (!achievement_id) {
        return res.status(400).json({
          success: false,
          message: "achievement_id is required"
        });
      }

      const result = await pool.query(
        `
        UPDATE "Achievement"
        SET 
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          icon = COALESCE($3, icon)
        WHERE achievement_id = $4
        RETURNING *
        `,
        [title, description, icon, achievement_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Achievement not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Achievement updated",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Remove achievement
    // =========================================================
    if (req.method === "DELETE") {

      const { achievement_id } = req.body;

      if (!achievement_id) {
        return res.status(400).json({
          success: false,
          message: "achievement_id is required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "Achievement"
        WHERE achievement_id = $1
        RETURNING *
        `,
        [achievement_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Achievement not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Achievement deleted",
        data: result.rows[0]
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("ACHIEVEMENTS API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}