import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

export function generateAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role || "user" },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role || "user" },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}
