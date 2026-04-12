//import prisma from "./prisma.js"

//export const logAudit = async ({
  req,
  action,
  entity_type,
  entity_id,
  status_code,
  success,
  error_message,
  response_payload
//}) => {
  try {
   // const user = req.user || {} // from your authenticate middleware

    await prisma.auditLog.create({
      data: {
        user_id: user.user_id || null,
        email: user.email || null,

        action,
        entity_type,
        entity_id: entity_id ? String(entity_id) : null,

        endpoint: req.url,
        method: req.method,

        request_payload: req.body || null,
        response_payload: response_payload || null,

        status_code,
        success,
        error_message: error_message || null,

        ip_address: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        user_agent: req.headers["user-agent"]
      }
    })
  } catch (err) {
    console.error("Audit log failed:", err.message)
  }
//}