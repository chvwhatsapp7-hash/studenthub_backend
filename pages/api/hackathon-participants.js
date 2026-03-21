import pool from "../../lib/db";

export default async function handler(req, res) {

  try {

    if (req.method === "POST") {

      const { user_id, hackathon_id, team_name } = req.body;

      if (!user_id || !hackathon_id) {
        return res.status(400).json({
          message: "user_id and hackathon_id are required"
        });
      }

      const check = await pool.query(
        `SELECT * FROM "HackathonParticipant"
         WHERE user_id = $1 AND hackathon_id = $2`,
        [user_id, hackathon_id]
      );

      if (check.rows.length > 0) {
        return res.status(409).json({
          message: "Already registered"
        });
      }

      const insertQuery = `
        INSERT INTO "HackathonParticipant"
        (user_id, hackathon_id, team_name, registration_date)
        VALUES ($1,$2,$3,NOW())
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        user_id,
        hackathon_id,
        team_name || null
      ]);

      return res.status(201).json({
        success: true,
        message: "Registered successfully",
        data: result.rows[0]
      });
    }

    if (req.method === "DELETE") {

      const { user_id, hackathon_id } = req.body;

      if (!user_id || !hackathon_id) {
        return res.status(400).json({
          message: "user_id and hackathon_id required"
        });
      }

      const result = await pool.query(
        `DELETE FROM "HackathonParticipant"
         WHERE user_id = $1 AND hackathon_id = $2
         RETURNING *`,
        [user_id, hackathon_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Registration not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Unregistered successfully"
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });
  }
}