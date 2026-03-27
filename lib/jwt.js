import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

export function generateAccessToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role_id: user.role_id,
      full_name: user.full_name || "",
    },
    ACCESS_SECRET,
    { expiresIn: "1d" }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role_id: user.role_id,
      full_name: user.full_name
    },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}
