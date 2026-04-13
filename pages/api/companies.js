import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {
  // ✅ cors always first
  if (cors(req, res)) return;

  // ✅ authenticate once for ALL methods
  // const user = authenticate(req, res);
  // if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {

    // ── GET ───────────────────────────────────
    if (req.method === "GET") {

      const query = `SELECT * FROM "Company" ORDER BY created_at DESC`;
      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows
      });

    }

    // ── POST ──────────────────────────────────
    else if (req.method === "POST") {

      const {
        name,
        description,
        industry,
        website,
        logo_url,
        location,
        company_size,
        founded_year
      } = req.body;

      const query = `
        INSERT INTO "Company"
        (name, description, industry, website, logo_url, location, company_size, founded_year, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;

      const result = await pool.query(query, [
        name, description, industry, website,
        logo_url, location, company_size, founded_year
      ]);

      return res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: result.rows[0]
      });

    }

    // ── PUT ───────────────────────────────────
    else if (req.method === "PUT") {

      const { company_id, name, location, description } = req.body;

      const query = `
        UPDATE "Company"
        SET name = $1,
            location = $2,
            description = $3,
            updated_at = NOW()
        WHERE company_id = $4
        RETURNING *
      `;

      const result = await pool.query(query, [name, location, description, company_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Company updated successfully",
        data: result.rows[0]
      });

    }

    // ── DELETE ────────────────────────────────
    else if (req.method === "DELETE") {

      const { company_id } = req.body;

      const query = `DELETE FROM "Company" WHERE company_id = $1 RETURNING *`;
      const result = await pool.query(query, [company_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Company deleted successfully",
        data: result.rows[0]
      });

    }

    // ── METHOD NOT ALLOWED ────────────────────
    else {
      return res.status(405).json({ message: "Method not allowed" });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
}
