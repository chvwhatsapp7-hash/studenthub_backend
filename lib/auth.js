import jwt from "jsonwebtoken";
import cookie from "cookie";
import { generateAccessToken, generateRefreshToken } from "./jwt.js";

export function authenticate(req, res) {
  const cookies = cookie.parse(req.headers.cookie || "");
  let accessToken = cookies.accessToken;
  const refreshToken = cookies.refreshToken;

  if (!accessToken && req.headers.authorization?.startsWith("Bearer ")) {
    accessToken = req.headers.authorization.split(" ")[1];
  }

  if (!accessToken && !refreshToken) {
    if (res) return null;
    throw new Error("No token provided");
  }

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);
      return decoded; // { user_id, role }
    } catch (err) {
      if (err.name !== "TokenExpiredError") {
        throw new Error("Invalid access token");
      }
    }
  }

  if (!refreshToken) throw new Error("Refresh token missing");

  let decodedRefresh;
  let needNewRefreshToken = false;

  try {
    decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      decodedRefresh = jwt.decode(refreshToken);
      if (!decodedRefresh?.user_id) throw new Error("Invalid refresh token");
      needNewRefreshToken = true;
    } else {
      throw new Error("Invalid refresh token");
    }
  }


  const newAccessToken = generateAccessToken({
    user_id: decodedRefresh.user_id,
    role: decodedRefresh.role,
  });

  
  let newRefreshToken = refreshToken;
  if (needNewRefreshToken) {
    newRefreshToken = generateRefreshToken({
      user_id: decodedRefresh.user_id,
      role: decodedRefresh.role,
    });
  }

  const isProd = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", [
    cookie.serialize("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 15 * 60,
    }),
    cookie.serialize("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    }),
  ]);

  return decodedRefresh; // { user_id, role }
}
