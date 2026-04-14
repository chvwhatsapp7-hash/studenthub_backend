import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export default async function handler(req, res) {

  // ✅ CORS FIRST
  if (cors(req, res)) return;

  // ✅ AUTH (ENABLE if needed)
  // const user = authenticate(req, res);
  // if (!user) {
  //   return res.status(401).json({
  //     success: false,
  //     message: "Unauthorized"
  //   });
  // }

  try {

    // =========================================================
    // GET — Fetch Companies
    // =========================================================
    if (req.method === "GET") {

      const result = await pool.query(
        `SELECT * FROM "Company" ORDER BY created_at DESC`
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // POST — Create Company
    // =========================================================
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

      // ✅ VALIDATION
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Company name is required"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO "Company"
        (name, description, industry, website, logo_url, location, company_size, founded_year, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
        RETURNING *
        `,
        [
          name,
          description,
          industry,
          website,
          logo_url,
          location,
          company_size,
          founded_year
        ]
      );

      console.log("📥 Company created:", name);

      return res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // PUT — Update Company
    // =========================================================
    else if (req.method === "PUT") {

      const { company_id, name, location, description } = req.body;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: "company_id is required"
        });
      }

      const result = await pool.query(
        `
        UPDATE "Company"
        SET name=$1,
            location=$2,
            description=$3,
            updated_at=NOW()
        WHERE company_id=$4
        RETURNING *
        `,
        [name, location, description, company_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Company not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Company updated successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // DELETE — Remove Company
    // =========================================================
    else if (req.method === "DELETE") {

      const { company_id } = req.body;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: "company_id is required"
        });
      }

      const result = await pool.query(
        `DELETE FROM "Company" WHERE company_id=$1 RETURNING *`,
        [company_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Company not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Company deleted successfully",
        data: result.rows[0]
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("🔥 COMPANY API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}