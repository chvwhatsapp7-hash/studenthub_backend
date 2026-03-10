import {pool} from "../../lib/database";

export default async function handler(req, res){

  try{

    // -------------------- CREATE HACKATHON --------------------
    if(req.method === "POST"){

      const {
        title,
        organizer,
        location,
        start_date,
        end_date,
        description
      } = req.body;

      const query = `
        INSERT INTO "Hackathon"
        (title, organizer, location, start_date, end_date, description)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `;

      const values = [
        title,
        organizer,
        location,
        start_date,
        end_date,
        description
      ];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Hackathon created successfully",
        data: result.rows[0]
      });

    }

    // -------------------- GET HACKATHONS --------------------
    else if(req.method === "GET"){

      const query = `
        SELECT * FROM "Hackathon"
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: result.rows
      });

    }

    // -------------------- UPDATE HACKATHON --------------------
    else if(req.method === "PUT"){

      const {
        hackathon_id,
        title,
        organizer,
        location,
        start_date,
        end_date,
        description
      } = req.body;

      const query = `
        UPDATE "Hackathon"
        SET title=$1,
            organizer=$2,
            location=$3,
            start_date=$4,
            end_date=$5,
            description=$6
        WHERE hackathon_id=$7
        RETURNING *
      `;

      const values = [
        title,
        organizer,
        location,
        start_date,
        end_date,
        description,
        hackathon_id
      ];

      const result = await pool.query(query, values);

      return res.status(200).json({
        success: true,
        message: "Hackathon updated successfully",
        data: result.rows[0]
      });

    }

    // -------------------- DELETE HACKATHON --------------------
    else if(req.method === "DELETE"){

      const { hackathon_id } = req.body;

      const query = `
        DELETE FROM "Hackathon"
        WHERE hackathon_id=$1
        RETURNING *
      `;

      const result = await pool.query(query, [hackathon_id]);

      return res.status(200).json({
        success: true,
        message: "Hackathon deleted successfully",
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