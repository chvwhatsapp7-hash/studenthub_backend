import { sendNotification } from "../../../lib/sendNotification";
import { authenticate } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return res.status(401).json({ success: false });

  await sendNotification(
    user.user_id,
    "Test Notification",
    "Your push is working 🔥"
  );

  res.status(200).json({ success: true });
}