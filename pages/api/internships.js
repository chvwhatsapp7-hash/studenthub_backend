import pool from "../../lib/db";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotificationToAll } from "../../lib/sendNotificationToAll";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // ✅ Then authenticate
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {

    // ═══════════════════════════════════════════
    // POST — Create Internship + Skills + Notification
    // ═══════════════════════════════════════════
    if (req.method === "POST") {
      const {
        title,
        company_id,
        location,
        duration,
        stipend,
        description,
        skill_ids = [],
      } = req.body;

      // 🔹 Insert internship
      const internResult = await pool.query(`
        INSERT INTO "Internship"
        (title, company_id, location, duration, stipend, description, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        RETURNING *
      `, [title, company_id, location, duration, stipend, description]);

      const intern = internResult.rows[0];

      // 🔹 Link skills
      if (skill_ids.length > 0) {
        for (const skill_id of skill_ids) {
          await pool.query(`
            INSERT INTO "InternshipSkill"(internship_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [intern.internship_id, skill_id]);
        }
      }

      // =====================================================
      // 🔔 STORE NOTIFICATION FOR ALL USERS
      // =====================================================
      await pool.query(`
        INSERT INTO "Notification" (user_id, title, message, type, is_read, created_at)
        SELECT user_id,
               'New Internship Posted',
               'A new internship is available. Check it out!',
               'internship',
               false,
               NOW()
        FROM "User"
      `);

      // =====================================================
      // 🔥 SEND PUSH TO ALL USERS
      // =====================================================
      await sendNotificationToAll(
        "New Internship Posted",
        "A new internship is available. Check it out!"
      );

      return res.status(201).json({
        success: true,
        data: intern,
      });
    }

    // ═══════════════════════════════════════════
    // GET — Fetch All Internships with Skills
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
    // PUT — Update Internship + Skills
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
        skill_ids,
      } = req.body;

      // 🔹 Update internship
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

      // 🔹 Update skills
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
    // DELETE — Remove Internship + Skills
    // ═══════════════════════════════════════════
    else if (req.method === "DELETE") {
      const { internship_id } = req.body;

      // 🔹 Delete skills first
      await pool.query(
        `DELETE FROM "InternshipSkill" WHERE internship_id = $1`,
        [internship_id]
      );

      // 🔹 Delete internship
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
    console.error("INTERNSHIP API ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}
