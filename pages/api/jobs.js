import pool from "../../lib/db";

export default async function handler(req,res){

  try{

    if(req.method === "POST"){

  const {
    title,
    company_id,
    location,
    description
  } = req.body;

  const query = `
  INSERT INTO "Job"
  (title, company_id, location, description, created_at, updated_at)
  VALUES ($1,$2,$3,$4,NOW(),NOW())
  RETURNING *
  `;

  const values = [
    title,
    company_id,
    location,
    description
  ];

  const result = await pool.query(query, values);

  return res.status(201).json({
    success:true,
    data:result.rows[0]
  });

}
    else if(req.method === "GET"){

      const result = await pool.query(`
        SELECT * FROM "Job"
        ORDER BY created_at DESC
      `);

      return res.status(200).json({
        success:true,
        data:result.rows
      });

    }

    else if(req.method === "PUT"){

      const {
        job_id,
        title,
        company_id,
        location,
        description
      } = req.body;

      const result = await pool.query(`
        UPDATE "Job"
        SET title=$1,
            company_id=$2,
            location=$3,
            description=$4
        WHERE job_id=$5
        RETURNING *
      `,[title,company_id,location,description,job_id]);

      return res.status(200).json({
        success:true,
        data:result.rows[0]
      });

    }

    else if(req.method === "DELETE"){

      const { job_id } = req.body;

      const result = await pool.query(`
        DELETE FROM "Job"
        WHERE job_id=$1
        RETURNING *
      `,[job_id]);

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