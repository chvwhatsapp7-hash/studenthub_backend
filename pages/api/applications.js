import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotification } from "../../lib/sendNotifications"; // optional (single user push)

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {

    // =========================================================
    // GET — FETCH USER APPLICATIONS
    // =========================================================
    if (req.method === "GET") {

      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "user_id is required"
        });
      }

      if (Number(user.user_id) !== Number(user_id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }

      const query = `
        SELECT 
          a.id,
          a.status,
          a.applied_at,

          j.job_id,
          j.title AS job_title,

          i.internship_id,
          i.title AS internship_title,

          c.name AS company_name,

          CASE 
            WHEN a.job_id IS NOT NULL THEN 'job'
            ELSE 'internship'
          END AS type

        FROM "Application" a
        LEFT JOIN "Job" j ON a.job_id = j.job_id
        LEFT JOIN "Internship" i ON a.internship_id = i.internship_id
        LEFT JOIN "Company" c 
          ON c.company_id = COALESCE(j.company_id, i.company_id)

        WHERE a.user_id = $1
        ORDER BY a.applied_at DESC
      `;

      const result = await pool.query(query, [user_id]);

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — APPLY + NOTIFICATION
    // =========================================================
    if (req.method === "POST") {

      const { user_id, job_id, internship_id } = req.body;

      if (!user_id || (!job_id && !internship_id)) {
        return res.status(400).json({
          success: false,
          message: "user_id and (job_id OR internship_id) are required"
        });
      }

      if (Number(user.user_id) !== Number(user_id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }

      // 🔍 Duplicate check
      const checkQuery = `
        SELECT id FROM "Application"
        WHERE user_id = $1
        AND (
          (job_id = $2 AND $2 IS NOT NULL)
          OR (internship_id = $3 AND $3 IS NOT NULL)
        )
      `;

      const existing = await pool.query(checkQuery, [
        user_id,
        job_id ?? null,
        internship_id ?? null
      ]);

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Already applied"
        });
      }

      // 📝 Insert Application
      const insertQuery = `
        INSERT INTO "Application"
        (user_id, job_id, internship_id, status, applied_at)
        VALUES ($1, $2, $3, 'applied', NOW())
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        user_id,
        job_id || null,
        internship_id || null
      ]);

      const application = result.rows[0];

      // ======================================================
      // 🔔 STORE NOTIFICATION (SINGLE USER)
      // ======================================================
      try {
        const isJob = !!job_id;

        const notifTitle = "Application Submitted";
        const notifMessage = isJob
          ? "You applied for a job successfully"
          : "You applied for an internship successfully";

        const entityId = isJob ? job_id : internship_id;
        const redirectUrl = isJob
          ? `/jobs/${job_id}`
          : `/internships/${internship_id}`;

        await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, entity_id, redirect_url, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
          `,
          [
            user_id,
            notifTitle,
            notifMessage,
            isJob ? "job" : "internship",
            entityId,
            redirectUrl
          ]
        );

      } catch (err) {
        console.error("❌ Notification insert failed:", err.message);
      }

      // ======================================================
      // 🔥 PUSH (OPTIONAL — SAFE)
      // ======================================================
      try {
        await sendNotification(
          user_id,
          "Application Submitted",
          "Your application was submitted successfully"
        );
      } catch (err) {
        console.error("❌ Push failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        data: application
      });
    }

    // =========================================================
    // DELETE — WITHDRAW APPLICATION
    // =========================================================
    if (req.method === "DELETE") {

      const { user_id, job_id, internship_id } = req.body;

      if (!user_id || (!job_id && !internship_id)) {
        return res.status(400).json({
          success: false,
          message: "user_id and (job_id OR internship_id) required"
        });
      }

      if (Number(user.user_id) !== Number(user_id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }

      const deleteQuery = `
        DELETE FROM "Application"
        WHERE user_id = $1
        AND (
          (job_id = $2 AND $2 IS NOT NULL)
          OR (internship_id = $3 AND $3 IS NOT NULL)
        )
        RETURNING *
      `;

      const result = await pool.query(deleteQuery, [
        user_id,
        job_id ?? null,
        internship_id ?? null
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Application withdrawn successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("APPLICATION ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}