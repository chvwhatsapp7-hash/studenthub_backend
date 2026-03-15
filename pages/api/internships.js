import pool from "../../lib/db";

export default async function handler(req,res){

  try{

    if(req.method === "POST"){

  const {
    title,
    company_id,
    location,
    duration,
    stipend,
    description
  } = req.body;

  const result = await pool.query(`
    INSERT INTO "Internship"
    (title,company_id,location,duration,stipend,description,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
    RETURNING *
  `,[title,company_id,location,duration,stipend,description]);

  return res.status(201).json({
    success:true,
    data:result.rows[0]
  });

}


    else if(req.method === "GET"){

      const result = await pool.query(`
        SELECT * FROM "Internship"
        ORDER BY created_at DESC
      `);

      return res.status(200).json({
        success:true,
        data:result.rows
      });

    }

    else if(req.method === "PUT"){

      const {
        internship_id,
        title,
        company_id,
        location,
        duration,
        stipend,
        description
      } = req.body;

      const result = await pool.query(`
        UPDATE "Internship"
        SET title=$1,
            company_id=$2,
            location=$3,
            duration=$4,
            stipend=$5,
            description=$6
        WHERE internship_id=$7
        RETURNING *
      `,[title,company_id,location,duration,stipend,description,internship_id]);

      return res.status(200).json({
        success:true,
        data:result.rows[0]
      });

    }

    else if(req.method === "DELETE"){

      const { internship_id } = req.body;

      const result = await pool.query(`
        DELETE FROM "Internship"
        WHERE internship_id=$1
        RETURNING *
      `,[internship_id]);

      return res.status(200).json({
        success:true,
        data:result.rows[0]
      });

    }

  }catch(err){

    console.error(err);

    return res.status(500).json({
      message:err.message
    });

  }

}