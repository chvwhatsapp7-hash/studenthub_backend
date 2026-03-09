export default function handler(req,res){

  const companies = [
    {id:1,name:"Google",location:"Hyderabad"},
    {id:2,name:"Microsoft",location:"Bangalore"}
  ];

  res.status(200).json({
    success:true,
    companies
  });

}