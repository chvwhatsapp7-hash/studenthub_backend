import {pool} from "../../lib/database";

export default async function handler(req, res){

  try{

    // -------------------- CREATE COMPANY --------------------
    if(req.method === "POST"){

      const {
        name,
        location,
        description
      } = req.body;

      const query = `
        INSERT INTO "Company"
        (name, location, description)
        VALUES ($1,$2,$3)
        RETURNING *
      `;

      const values = [
        name,
        location,
        description
      ];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: result.rows[0]
      });

    }

    // -------------------- GET COMPANIES --------------------
    else if(req.method === "GET"){

      const query = `
        SELECT * FROM "Company"
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows
      });

    }

    // -------------------- UPDATE COMPANY --------------------
    else if(req.method === "PUT"){

      const {
        company_id,
        name,
        location,
        description
      } = req.body;

      const query = `
        UPDATE "Company"
        SET name=$1,
            location=$2,
            description=$3
        WHERE company_id=$4
        RETURNING *
      `;

      const values = [
        name,
        location,
        description,
        company_id
      ];

      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        message: "Company updated successfully",
        data: result.rows[0]
      });

    }

    // -------------------- DELETE COMPANY --------------------
    else if(req.method === "DELETE"){

      const { company_id } = req.body;

      const query = `
        DELETE FROM "Company"
        WHERE company_id=$1
        RETURNING *
      `;

      const result = await pool.query(query, [company_id]);

      return res.status(200).json({
        success: true,
        message: "Company deleted successfully",
        data: result.rows[0]
      });

    }

    // -------------------- INVALID METHOD --------------------
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