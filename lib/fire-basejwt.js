import admin from "firebase-admin";
// import serviceAccount from "./internship-frontend-firebase-adminsdk-fbsvc-2f5d720038.json";

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
