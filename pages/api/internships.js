import pool from "../../lib/db";
import { cors } from "../../lib/cors";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {

    // ═══════════════════════════════════════════
    //  POST — Create Internship + Link Skills by ID
    // ═══════════════════════════════════════════
    if (req.method === "POST") {
      const {
        title,
        company_id,
        location,
        duration,
        stipend,
        description,
        skill_ids = [], // ✅ array of skill IDs e.g. [1, 3, 7]
      } = req.body;

      // 1️⃣ Insert internship
      const internResult = await pool.query(`
        INSERT INTO "Internship"
        (title, company_id, location, duration, stipend, description, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        RETURNING *
      `, [title, company_id, location, duration, stipend, description]);

      const intern = internResult.rows[0];

      // 2️⃣ Link skills directly by ID — no name lookup needed
      if (skill_ids.length > 0) {
        for (const skill_id of skill_ids) {
          await pool.query(`
            INSERT INTO "InternshipSkill"(internship_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [intern.internship_id, skill_id]);
        }
      }

      return res.status(201).json({
        success: true,
        data: intern,
      });
    }

    // ═══════════════════════════════════════════
    //  GET — Fetch All Internships with Skills
    // ═══════════════════════════════════════════
    else if (req.method === "GET") {
      const result = await pool.query(`
        SELECT
          i.*,
          COALESCE(
            json_agg(
              json_build_object('skill_id', s.skill_id, 'name', s.name)
            ) FILTER (WHERE s.name IS NOT NULL), '[]'
          ) AS skills
        FROM "Internship" i
        LEFT JOIN "InternshipSkill" ist ON ist.internship_id = i.internship_id
        LEFT JOIN "Skill" s ON s.skill_id = ist.skill_id
        GROUP BY i.internship_id
        ORDER BY i.created_at DESC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // ═══════════════════════════════════════════
    //  PUT — Update Internship + Re-link Skills by ID
    // ═══════════════════════════════════════════
    else if (req.method === "PUT") {
      const {
        internship_id,
        title,
        company_id,
        location,
        duration,
        stipend,
        description,
        skill_ids, // ✅ optional array of skill IDs
      } = req.body;

      // 1️⃣ Update internship
      const result = await pool.query(`
        UPDATE "Internship"
        SET title=$1,
            company_id=$2,
            location=$3,
            duration=$4,
            stipend=$5,
            description=$6,
            updated_at=NOW()
        WHERE internship_id=$7
        RETURNING *
      `, [title, company_id, location, duration, stipend, description, internship_id]);

      // 2️⃣ If skill_ids provided — delete old and re-insert
      if (skill_ids && skill_ids.length > 0) {
        await pool.query(
          `DELETE FROM "InternshipSkill" WHERE internship_id = $1`,
          [internship_id]
        );

        for (const skill_id of skill_ids) {
          await pool.query(`
            INSERT INTO "InternshipSkill"(internship_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [internship_id, skill_id]);
        }
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    }

    // ═══════════════════════════════════════════
    //  DELETE — Remove Internship + Skills
    // ═══════════════════════════════════════════
    else if (req.method === "DELETE") {
      const { internship_id } = req.body;

      // 1️⃣ Delete linked skills first
      await pool.query(
        `DELETE FROM "InternshipSkill" WHERE internship_id = $1`,
        [internship_id]
      );

      // 2️⃣ Delete internship
      const result = await pool.query(`
        DELETE FROM "Internship"
        WHERE internship_id=$1
        RETURNING *
      `, [internship_id]);

      return res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
}
