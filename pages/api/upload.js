import { upload } from "../../lib/cloudinary";
import { cors } from "../../lib/cors";
import { authenticate } from "../../lib/auth";

export const config = {
  api: {
    bodyParser: false
  }
};

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticate(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    await runMiddleware(req, res, upload.single("file"));

    return res.status(200).json({
      success: true,
      file_url: req.file.path,
      file_type: req.file.mimetype,
      original_name: req.file.originalname,
      public_id: req.file.filename
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}