import {pool} from "../../lib/database";

export default async function handler(req, res){

  try{

    // -------------------- CREATE INTERNSHIP --------------------
    if(req.method === "POST"){

      const {
        title,
        company_name,
        location,
        duration,
        stipend,
        description
      } = req.body;

      const query = `
        INSERT INTO "Internship"
        (title, company_name, location, duration, stipend, description)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `;

      const values = [
        title,
        company_name,
        location,
        duration,
        stipend,
        description
      ];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Internship created successfully",
        data: result.rows[0]
      });

    }

    // -------------------- GET INTERNSHIPS --------------------
    else if(req.method === "GET"){

      const query = `
        SELECT * FROM "Internship"
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows
      });

    }

    // -------------------- UPDATE INTERNSHIP --------------------
    else if(req.method === "PUT"){

      const {
        internship_id,
        title,
        company_name,
        location,
        duration,
        stipend,
        description
      } = req.body;

      const query = `
        UPDATE "Internship"
        SET title=$1,
            company_name=$2,
            location=$3,
            duration=$4,
            stipend=$5,
            description=$6
        WHERE internship_id=$7
        RETURNING *
      `;

      const values = [
        title,
        company_name,
        location,
        duration,
        stipend,
        description,
        internship_id
      ];

      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        message: "Internship updated successfully",
        data: result.rows[0]
      });

    }

    // -------------------- DELETE INTERNSHIP --------------------
    else if(req.method === "DELETE"){

      const { internship_id } = req.body;

      const query = `
        DELETE FROM "Internship"
        WHERE internship_id=$1
        RETURNING *
      `;

      const result = await pool.query(query, [internship_id]);

      return res.status(200).json({
        success: true,
        message: "Internship deleted successfully",
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