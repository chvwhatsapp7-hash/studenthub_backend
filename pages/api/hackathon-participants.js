import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

// ❗ Keep this commented unless you create the file
// import { sendNotification } from "../../lib/sendNotifications";

export default async function handler(req, res) {

  // ✅ CORS FIRST
  if (cors(req, res)) return;

  // ✅ AUTH
  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const user_id = user.user_id; // 🔥 always from token

  try {

    // =========================================================
    // POST — Register + Notification
    // =========================================================
    if (req.method === "POST") {

      const { hackathon_id, team_name } = req.body;

      if (!hackathon_id) {
        return res.status(400).json({
          success: false,
          message: "hackathon_id is required"
        });
      }

      // 🔍 Duplicate check
      const check = await pool.query(
        `SELECT 1 FROM "HackathonParticipant"
         WHERE user_id = $1 AND hackathon_id = $2`,
        [user_id, hackathon_id]
      );

      if (check.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Already registered"
        });
      }

      // 🔹 Insert
      const result = await pool.query(
        `
        INSERT INTO "HackathonParticipant"
        (user_id, hackathon_id, team_name, registration_date)
        VALUES ($1,$2,$3,NOW())
        RETURNING *
        `,
        [user_id, hackathon_id, team_name || null]
      );

      const participant = result.rows[0];

      // 🔍 Get hackathon title
      const hackRes = await pool.query(
        `SELECT title FROM "Hackathon" WHERE hackathon_id = $1`,
        [hackathon_id]
      );

      const hackathonTitle = hackRes.rows[0]?.title || "Hackathon";

      // ======================================================
      // 🔔 STORE NOTIFICATION
      // ======================================================
      try {
        await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, redirect_url, is_read, created_at)
          VALUES ($1, $2, $3, 'hackathon', $4, $5, false, NOW())
          `,
          [
            user_id,
            "Registration Successful",
            `You registered for ${hackathonTitle}`,
            hackathon_id,
            `/hackathons/${hackathon_id}`
          ]
        );
      } catch (err) {
        console.error("❌ Notification insert failed:", err.message);
      }

      // ======================================================
      // 🔥 PUSH (OPTIONAL — SAFE)
      // ======================================================
      try {
        // await sendNotification(
        //   user_id,
        //   "Registration Successful",
        //   `You registered for ${hackathonTitle}`
        // );
      } catch (err) {
        console.error("❌ Push failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Registered successfully",
        data: participant
      });
    }

    // =========================================================
    // DELETE — Unregister
    // =========================================================
    if (req.method === "DELETE") {

      const { hackathon_id } = req.body;

      if (!hackathon_id) {
        return res.status(400).json({
          success: false,
          message: "hackathon_id required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "HackathonParticipant"
        WHERE user_id = $1 AND hackathon_id = $2
        RETURNING *
        `,
        [user_id, hackathon_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Registration not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Unregistered successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {

    console.error("HACKATHON PARTICIPANT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}