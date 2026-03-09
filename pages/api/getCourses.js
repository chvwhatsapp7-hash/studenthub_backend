export default function handler(req,res){

  const courses = [
    {
      id:1,
      title:"Python Programming",
      duration:"30 days"
    },
    {
      id:2,
      title:"Web Development",
      duration:"40 days"
    }
  ];

  res.status(200).json({
    success:true,
    courses
  });

}