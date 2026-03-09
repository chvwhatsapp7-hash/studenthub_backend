export default function handler(req,res){

  if(req.method !== "POST"){
    return res.status(405).json({message:"Only POST allowed"});
  }

  const {email,password} = req.body;

  res.status(200).json({
    success:true,
    message:"Login API working",
    email
  });

}