import prisma from "../../../lib/prisma";
import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";

// Handle BigInt serialization
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

export default async function handler(req, res) {
  // CORS
  if (cors(req, res)) return;

  // AUTH
  const admin = authenticate(req, res);
  if (!admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const { id } = req.query;

      const userId = parseInt(id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }

      const userDetails = await prisma.user.findUnique({
        where: { user_id: userId },
        include: {
          role: true,
          applications: { 
            include: { 
              job: { include: { company: true } }, 
              internship: { include: { company: true } } 
            } 
          },
          courseEnrollments: { include: { course: true } },
          hackathonParticipations: { include: { hackathon: true } },
          userSkills: { include: { skill: true } },
          projects: true,
          certificates: true,
          savedCourses: { include: { course: true } },
          interests: { include: { interest: true } },
          achievements: { include: { achievement: true } },
          upload: true,
          notifications: true,
          devices: true
        }
      });

      if (!userDetails) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const {
        role,
        applications,
        courseEnrollments,
        hackathonParticipations,
        userSkills,
        projects,
        certificates,
        savedCourses,
        interests,
        achievements,
        upload,
        notifications,
        devices,
        ...basicUser
      } = userDetails;

      return res.status(200).json({
        success: true,
        user: { ...basicUser, role_name: role?.role_name },
        applications: applications || [],
        courses: courseEnrollments || [],
        hackathons: hackathonParticipations || [],
        skills: userSkills || [],
        projects: projects || [],
        certificates: certificates || [],
        savedCourses: savedCourses || [],
        interests: interests || [],
        achievements: achievements || [],
        uploads: upload || [],
        notifications: notifications || [],
        devices: devices || []
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
