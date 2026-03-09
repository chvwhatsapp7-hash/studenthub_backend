import pool from "../../lib/db";

export default async function handler(req, res) {

  try {

    if (req.method === "GET") {

      const result = await pool.query('SELECT * FROM "Job"');

      return res.status(200).json({
        jobs: result.rows
      });

    }

    if (req.method === "POST") {

      const { title, company_name, location, description } = req.body;

      const query = `
        INSERT INTO "Job"
        (title, company_name, location, description)
        VALUES ($1,$2,$3,$4)
        RETURNING *;
      `;

      const values = [title, company_name, location, description];

      const result = await pool.query(query, values);

      return res.status(201).json({
        message: "Job inserted",
        job: result.rows[0]
      });

    }

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      message: err.message
    });

  }
}
