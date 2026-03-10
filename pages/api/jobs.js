import {pool} from "../../lib/database"

export default async function handler(req, res){

  try{

    // -------------------- CREATE JOB --------------------
    if(req.method === "POST"){

      const {
        title,
        company_name,
        location,
        description
      } = req.body;

      const query = `
        INSERT INTO "Job"
        (title, company_name, location, description)
        VALUES ($1,$2,$3,$4)
        RETURNING *
      `;

      const values = [
        title,
        company_name,
        location,
        description
      ];

      const result = await pool.query(query,values);

      return res.status(201).json({
        success:true,
        message:"Job created successfully",
        data:result.rows[0]
      });

    }

    // -------------------- GET JOBS --------------------
    else if(req.method === "GET"){

      const query = `
        SELECT * FROM "Job"
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success:true,
        data:result.rows
      });

    }

    // -------------------- UPDATE JOB --------------------
    else if(req.method === "PUT"){

      const {
        job_id,
        title,
        company_name,
        location,
        description
      } = req.body;

      const query = `
        UPDATE "Job"
        SET title=$1,
            company_name=$2,
            location=$3,
            description=$4
        WHERE job_id=$5
        RETURNING *
      `;

      const values = [
        title,
        company_name,
        location,
        description,
        job_id
      ];

      const result = await pool.query(query,values);

      return res.status(200).json({
        success:true,
        message:"Job updated successfully",
        data:result.rows[0]
      });

    }

    // -------------------- DELETE JOB --------------------
    else if(req.method === "DELETE"){

      const { job_id } = req.body;

      const query = `
        DELETE FROM "Job"
        WHERE job_id=$1
        RETURNING *
      `;

      const result = await pool.query(query,[job_id]);

      return res.status(200).json({
        success:true,
        message:"Job deleted successfully",
        data:result.rows[0]
      });

    }

    // -------------------- INVALID METHOD --------------------
    else{
      return res.status(405).json({
        message:"Method not allowed"
      });
    }

  }catch(err){

    console.error(err);

    return res.status(500).json({
      message:err.message
    });

  }

}