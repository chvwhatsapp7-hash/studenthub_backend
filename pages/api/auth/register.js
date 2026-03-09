import bcrypt from "bcrypt";
import pool from "../../../lib/db";

export default async function handler(req,res){

  if(req.method !== "POST"){
    return res.status(405).json({message:"Only POST allowed"});
  }

  try{

    const {
      name,
      email,
      password,
      age,
      school,
      college,
      interests
    } = req.body;

    const hashedPassword = await bcrypt.hash(password,10);

    const query = `
      INSERT INTO "User"
      (name,email,password,age,school,college,interests,role_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;

    const values = [
      name,
      email,
      hashedPassword,
      age,
      school,
      college,
      interests,
      1
    ];

    const result = await pool.query(query,values);

    res.status(201).json({
      success:true,
      message:"User stored in Neon",
      data:result.rows[0]
    });

  }catch(err){

  console.error(err);

  res.status(500).json({
    message: err.message
  });

}
}