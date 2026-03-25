import {pool} from "../../lib/database";
import{cors} from "../../lib/cors";

export default async function handler(req, res){
  if (cors(req, res)) return;

  try{


   if (req.method === "POST") {

  const {
    title,
    description,
    provider,
    instructor,
    category,
    level,
    duration,
    course_url,
    price,
    rating,
    skill_ids,   // ← only this, e.g. [1, 2, 3]
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message: "title and description are required",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1️⃣ Insert course
    const courseResult = await client.query(
      `
      INSERT INTO "Course"
        (title, description, provider, instructor, category, level, duration, course_url, price, rating, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
      `,
      [title, description, provider, instructor, category, level, duration, course_url, price, rating]
    );

    const course    = courseResult.rows[0];
    const course_id = course.course_id;
    const linkedSkills = [];

    // 2️⃣ Link skill_ids
    if (Array.isArray(skill_ids) && skill_ids.length > 0) {
      for (const skill_id of skill_ids) {

        // Validate skill exists
        const skillCheck = await client.query(
          `SELECT skill_id, name FROM "Skill" WHERE skill_id = $1`,
          [skill_id]
        );

        if (skillCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(400).json({
            success: false,
            message: `skill_id ${skill_id} does not exist`,
          });
        }

        // Insert into CourseSkill
        await client.query(
          `
          INSERT INTO "CourseSkill" (course_id, skill_id)
          VALUES ($1, $2)
          ON CONFLICT (course_id, skill_id) DO NOTHING
          `,
          [course_id, skill_id]
        );

        linkedSkills.push(skillCheck.rows[0].name);
      }
    }

    await client.query("COMMIT");
    client.release();

    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: {
        ...course,
        skills: linkedSkills,
      },
    });

  } catch (txErr) {
    await client.query("ROLLBACK");
    client.release();
    throw txErr;
  }
}
    
   else if (req.method === "GET") {

  const result = await pool.query(`
    SELECT
      c.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('skill_id', s.skill_id, 'name', s.name)
        ) FILTER (WHERE s.skill_id IS NOT NULL),
        '[]'
      ) AS skills
    FROM "Course" c
    LEFT JOIN "CourseSkill" cs ON c.course_id = cs.course_id
    LEFT JOIN "Skill" s        ON cs.skill_id  = s.skill_id
    WHERE c.status = 1
    GROUP BY c.course_id
    ORDER BY c.created_at DESC
  `);

  return res.status(200).json({
    success: true,
    data: result.rows,
  });
}

    
    else if(req.method === "PUT"){

      const {
        course_id,
        title,
        duration,
        description
      } = req.body;

      const query = `
        UPDATE "Course"
        SET title=$1,
            duration=$2,
            description=$3
        WHERE course_id=$4
        RETURNING *
      `;

      const values = [
        title,
        duration,
        description,
        course_id
      ];

      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        message: "Course updated successfully",
        data: result.rows[0]
      });

    }

    
    else if(req.method === "DELETE"){

      const { course_id } = req.body;

      const query = `
        DELETE FROM "Course"
        WHERE course_id=$1
        RETURNING *
      `;

      const result = await pool.query(query, [course_id]);

      return res.status(200).json({
        success: true,
        message: "Course deleted successfully",
        data: result.rows[0]
      });

    }

    
    else{

      return res.status(405).json({
        message: "Method not allowed"
      });

    }

  }catch(err){

    console.error(err);

    return res.status(500).json({
      message: err.message
    });

  }

}