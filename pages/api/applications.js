import pool from "../../lib/db";

export default async function handler(req, res) {

  try {

    if (req.method === "POST") {

      const { user_id, job_id, internship_id } = req.body;
      if (!user_id || (!job_id && !internship_id)) {
        return res.status(400).json({
          message: "user_id and (job_id OR internship_id) are required"
        });
      }

      const checkQuery = `
        SELECT * FROM "Application"
        WHERE user_id = $1
        AND (
          (job_id = $2 AND $2 IS NOT NULL)
          OR (internship_id = $3 AND $3 IS NOT NULL)
        )
      `;

      const existing = await pool.query(checkQuery, [
        user_id,
        job_id,
        internship_id
      ]);

      if (existing.rows.length > 0) {
        return res.status(409).json({
          message: "Already applied"
        });
      }

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

      return res.status(201).json({
        success: true,
        message: "Application submitted",
        data: result.rows[0]
      });
    }

    if (req.method === "DELETE") {

      const { user_id, job_id, internship_id } = req.body;

      if (!user_id || (!job_id && !internship_id)) {
        return res.status(400).json({
          message: "user_id and (job_id OR internship_id) required"
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
        job_id,
        internship_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Application not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Application withdrawn"
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      message: err.message
    });
  }
}