import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

// Replace verifyIdToken with this:
const ticket = await client.verifyIdToken({
  idToken: token,
  audience: [
    "710479367870-micu0jc76s5aqg2vfbu80k26b1k65mje.apps.googleusercontent.com",
    "710479367870-12ahpp9e9ugf5q7vu6v9hi16epqv5768.apps.googleusercontent.com",
  ],
});

const payload = ticket.getPayload();
const email = payload.email;
const name = payload.name || "User";