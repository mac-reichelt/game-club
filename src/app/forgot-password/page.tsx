import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Use account recovery to regain access to your account.
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Please contact your club admin to reset your password.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
