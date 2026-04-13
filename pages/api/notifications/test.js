import { cors } from "../../../lib/cors";
import { authenticate } from "../../../lib/auth";
import { sendNotificationToAll } from "../../../lib/sendNotificationToAll";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {

    if (req.method === "POST") {

      const { title, message } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: "title and message are required"
        });
      }

      // 🔥 Send push notification to all users
      await sendNotificationToAll(title, message);

      return res.status(200).json({
        success: true,
        message: "Test notification sent successfully"
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (err) {
    console.error("TEST NOTIFICATION ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}