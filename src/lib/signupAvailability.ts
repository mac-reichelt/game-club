export function isSignupAvailable(): boolean {
  return Boolean(process.env.SIGNUP_INVITE_CODE?.trim());
}
