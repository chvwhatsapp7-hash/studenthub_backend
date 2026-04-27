import { pool } from "../../lib/database";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";
import { sendNotificationToAll } from "../../lib/sendNotificationToAll";

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
    // POST — Create Internship + Skills + Public Notification
    // =========================================================
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

      if (!title || !company_id || !location || !description) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields"
        });
      }

      console.log("Creating internship:", title);

      // Insert internship
      const internResult = await pool.query(
        `
        INSERT INTO "Internship"
        (title, company_id, location, duration, stipend, description, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        RETURNING *
        `,
        [title, company_id, location, duration, stipend, description]
      );

      const intern = internResult.rows[0];

      // Link skills
      if (skill_ids.length > 0) {
        for (const skill_id of skill_ids) {
          await pool.query(
            `
            INSERT INTO "InternshipSkill"(internship_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [intern.internship_id, skill_id]
          );
        }
      }

      // =====================================================
      // STORE PUBLIC NOTIFICATION (ONLY COLLEGE USERS)
      // =====================================================
      try {

        const notifResult = await pool.query(
          `
          INSERT INTO "Notification"
          (user_id, title, message, type, category, entity_id, redirect_url, is_read, created_at)
          SELECT user_id,
                 $1,
                 $2,
                 'internship_public',
                 'public',
                 $3,
                 $4,
                 false,
                 NOW()
          FROM "User"
          WHERE role_id IN (3,4)
          RETURNING notification_id
          `,
          [
            "New Internship Posted",
            `${title} internship is now available`,
            intern.internship_id,
            `/internships/${intern.internship_id}`
          ]
        );

        console.log("Notifications inserted:", notifResult.rowCount);

      } catch (err) {
        console.error("Notification insert failed:", err.message);
      }

      // =====================================================
      // PUSH ONLY TO COLLEGE USERS
      // =====================================================
      try {
        await sendNotificationToAll(
          "New Internship Posted",
          `${title} internship is now available`,
          [3,4]
        );
      } catch (err) {
        console.error("Push failed:", err.message);
      }

      return res.status(201).json({
        success: true,
        message: "Internship created successfully",
        data: intern
      });
    }

    // =========================================================
    // GET — Fetch All Internships with Skills
    // =========================================================
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

    // =========================================================
    // PUT — Update Internship + Skills
    // =========================================================
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

      const result = await pool.query(
        `
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
        `,
        [title, company_id, location, duration, stipend, description, internship_id]
      );

      if (skill_ids && skill_ids.length > 0) {
        await pool.query(`DELETE FROM "InternshipSkill" WHERE internship_id = $1`, [internship_id]);

        for (const skill_id of skill_ids) {
          await pool.query(
            `
            INSERT INTO "InternshipSkill"(internship_id, skill_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [internship_id, skill_id]
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Internship updated successfully",
        data: result.rows[0],
      });
    }

    // =========================================================
    // DELETE — Remove Internship
    // =========================================================
    else if (req.method === "DELETE") {

      const { internship_id } = req.body;

      await pool.query(`DELETE FROM "InternshipSkill" WHERE internship_id = $1`, [internship_id]);

      const result = await pool.query(
        `DELETE FROM "Internship" WHERE internship_id=$1 RETURNING *`,
        [internship_id]
      );

      return res.status(200).json({
        success: true,
        message: "Internship deleted successfully",
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