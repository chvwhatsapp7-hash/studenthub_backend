import jwt from "jsonwebtoken";

export function authenticate(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    return decoded; // { user_id, role_id }

  } catch (err) {
    console.error("Auth error:", err.message);
    return null;
  }
}