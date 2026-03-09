export default function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Only GET allowed" });
  }

  const user = {
    user_id: 1,
    name: "Satvika",
    email: "satvika@test.com",
    role: "student",
    skills: ["C", "C++", "Web Development"]
  };

  res.status(200).json({
    success: true,
    data: user
  });

}