import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { upload } from "../../lib/cloudinary";

export const config = {
  api: {
    bodyParser: false
  }
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {

  const user = authenticate(req, res);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  if (cors(req, res)) return;

  try {

    // =========================================================
    // ✅ POST — Upload Certificate + Save to DB
    // =========================================================
    if (req.method === "POST") {

      await runMiddleware(req, res, upload.single("file"));

      console.log("REQ FILE:", req.file);

      const {
        user_id,
        title,
        issuer,
        issue_date
      } = req.body;

      // =====================================================
      // ✅ VALIDATION
      // =====================================================
      if (
        !user_id ||
        user_id === "null" ||
        user_id === "undefined" ||
        isNaN(Number(user_id))
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid user_id is required"
        });
      }

      if (!title || !issuer) {
        return res.status(400).json({
          success: false,
          message: "title and issuer are required"
        });
      }

      // =====================================================
      // ✅ FILE REQUIRED
      // =====================================================
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Certificate file is required"
        });
      }

      const file_url = req.file.path;

      // =====================================================
      // ✅ INSERT CERTIFICATE
      // =====================================================
      const result = await pool.query(
        `
        INSERT INTO "Certificate"
        (
          user_id,
          title,
          issuer,
          issue_date,
          file_url,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,NOW())
        RETURNING *
        `,
        [
          user_id,
          title,
          issuer,
          issue_date || null,
          file_url
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Certificate uploaded successfully",
        data: result.rows[0]
      });
    }

    // =========================================================
    // ✅ DELETE CERTIFICATE
    // =========================================================
    if (req.method === "DELETE") {

      const { certificate_id } = req.body;

      // =====================================================
      // ✅ VALIDATION
      // =====================================================
      if (
        !certificate_id ||
        isNaN(Number(certificate_id))
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid certificate_id is required"
        });
      }

      const result = await pool.query(
        `
        DELETE FROM "Certificate"
        WHERE certificate_id = $1
        RETURNING *
        `,
        [certificate_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Certificate deleted successfully"
      });
    }

    // =========================================================
    // ✅ GET USER CERTIFICATES
    // =========================================================
    if (req.method === "GET") {

      const { user_id } = req.query;

      // =====================================================
      // ✅ VALIDATION
      // =====================================================
      if (
        !user_id ||
        user_id === "null" ||
        user_id === "undefined" ||
        isNaN(Number(user_id))
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid user_id is required"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM "Certificate"
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [user_id]
      );

      return res.status(200).json({
        success: true,
        data: result.rows
      });
    }

    // =========================================================
    // ❌ METHOD NOT ALLOWED
    // =========================================================
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {

    console.error("CERTIFICATE API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}