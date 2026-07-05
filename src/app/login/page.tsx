import LoginForm from "./LoginForm";
import { isSignupAvailable } from "@/lib/signupAvailability";

export default function LoginPage() {
  return <LoginForm signupEnabled={isSignupAvailable()} />;
}
