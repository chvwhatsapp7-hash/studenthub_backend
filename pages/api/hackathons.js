import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
//import { sendNotificationToAll } from "../../lib/sendNotificationToAll";

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  if (cors(req, res)) return;

  try {

    // =========================================================
    // POST — Create Hackathon + Notification
    // =========================================================
    if (req.method === "POST") {

      const {
        title,
        organizer,
        location,
        start_date,
        end_date,
        description
      } = req.body;

      // 🔹 Insert Hackathon
      const result = await pool.query(
        `
        INSERT INTO "Hackathon"
        (title, organizer, location, start_date, end_date, description, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        RETURNING *
        `,
        [title, organizer, location, start_date, end_date, description]
      );

      const hackathon = result.rows[0];

      // =====================================================
      // 🔔 STORE NOTIFICATION FOR ALL USERS
      // =====================================================
      await pool.query(`
        INSERT INTO "Notification" (user_id, title, message, type, is_read, created_at)
        SELECT user_id,
               'New Hackathon Announced',
               'A new hackathon is live. Participate now!',
               'hackathon',
               false,
               NOW()
        FROM "User"
      `);

      // =====================================================
      // 🔥 SEND PUSH TO ALL USERS
      // =====================================================
      await sendNotificationToAll(
        "New Hackathon Announced",
        "A new hackathon is live. Participate now!"
      );

      return res.status(201).json({
        success: true,
        message: "Hackathon created successfully",
        data: hackathon
      });
    }

    // =========================================================
    // GET — Fetch Hackathons
    // =========================================================
    else if (req.method === "GET") {

      const result = await pool.query(`
        SELECT * FROM "Hackathon"
        ORDER BY created_at DESC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // PUT — Update Hackathon
    // =========================================================
    else if (req.method === "PUT") {

      const {
        hackathon_id,
        title,
        organizer,
        location,
        start_date,
        end_date,
        description
      } = req.body;

      const result = await pool.query(
        `
        UPDATE "Hackathon"
        SET title=$1,
            organizer=$2,
            location=$3,
            start_date=$4,
            end_date=$5,
            description=$6,
            updated_at = NOW()
        WHERE hackathon_id=$7
        RETURNING *
        `,
        [title, organizer, location, start_date, end_date, description, hackathon_id]
      );

      return res.status(200).json({
        success: true,
        message: "Hackathon updated successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Remove Hackathon
    // =========================================================
    else if (req.method === "DELETE") {

      const { hackathon_id } = req.body;

      const result = await pool.query(
        `DELETE FROM "Hackathon" WHERE hackathon_id=$1 RETURNING *`,
        [hackathon_id]
      );

      return res.status(200).json({
        success: true,
        message: "Hackathon deleted successfully",
        data: result.rows[0]
      });
    }

    return res.status(405).json({
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("HACKATHON API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}