import {pool} from "../../lib/db";
import {cors} from "../../lib/cors";

export default async function handler(req, res){
  if(cors(req, res)) return;

  try{


    if(req.method === "POST"){

      const {
  name,
  description,
  industry,
  website,
  logo_url,
  location,
  company_size,
  founded_year
} = req.body;

      const query = `
INSERT INTO "Company"
(name,description,industry,website,logo_url,location,company_size,founded_year,created_at,updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
RETURNING *
`;

      const values = [
  name,
  description,
  industry,
  website,
  logo_url,
  location,
  company_size,
  founded_year
];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: result.rows[0]
      });

    }


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