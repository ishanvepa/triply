export type AuthState = {
  error?: string;
  success?: string;
  confirmationEmail?: string;
  fields?: { email?: string; fullName?: string; password?: string };
  values?: { email?: string; fullName?: string };
};

export function validateCredentials(formData: FormData, signup: boolean) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const nameValue = formData.get("fullName");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  // Passwords are intentionally never trimmed, normalized, or returned in state.
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fullName = typeof nameValue === "string" ? nameValue.trim() : "";
  const fields: NonNullable<AuthState["fields"]> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    fields.email = "Enter a valid email address.";
  }
  if (!password || password.length > 128 || (signup && password.length < 8)) {
    fields.password = signup ? "Use a password with 8–128 characters." : "Enter your password.";
  }
  if (signup && (!fullName || fullName.length > 80)) {
    fields.fullName = "Enter a name with 1–80 characters.";
  }
  return { email, password, fullName, fields, valid: Object.keys(fields).length === 0 };
}

export function getAuthErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
    case "invalid_login_credentials": return "Email or password is incorrect.";
    case "email_not_confirmed": return "Confirm your email before signing in. Check your inbox for the confirmation link.";
    case "weak_password": return "Choose a stronger password. Try a longer mix of characters.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_email_send_rate": return "Too many attempts. Please wait a little and try again.";
    case "signup_disabled": return "New accounts are temporarily unavailable. Please try again later.";
    default: return "We couldn't complete that request. Please try again.";
  }
}
