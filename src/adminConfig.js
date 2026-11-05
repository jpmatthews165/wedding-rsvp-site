// Google accounts allowed into /admin. This list only controls what the admin
// page shows; the real enforcement is the matching list in firestore.rules.
export const ADMIN_EMAILS = [
  'jpmatthews165@gmail.com',
  'snehaandjosh2027@gmail.com',
  'snehamaria15@gmail.com',
];

export const isAdminEmail = (email) =>
  !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
