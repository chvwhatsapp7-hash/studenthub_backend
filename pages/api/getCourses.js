import {pool} from "../../lib/database";
import{cors} from "../../lib/cors";

export default async function handler(req, res){
  if (cors(req, res)) return;

  try{


    if(req.method === "POST"){

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
  rating
} = req.body;

      const query = `
INSERT INTO "Course"
(title,description,provider,instructor,category,level,duration,course_url,price,rating,created_at,updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
RETURNING *
`;

      const values = [
  title,
  description,
  provider,
  instructor,
  category,
  level,
  duration,
  course_url,
  price,
  rating
];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Course created successfully",
        data: result.rows[0]
      });

    }

    
    else if(req.method === "GET"){

      const query = `
        SELECT * FROM "Course"
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows
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