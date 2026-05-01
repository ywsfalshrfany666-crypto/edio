import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton } from "@/components/auth/AuthLayout";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const signUp = useAuth((s) => s.signUp);
  const loading = useAuth((s) => s.loading);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accept) {
      setError("Please accept the terms to continue.");
      return;
    }
    const { error } = await signUp({ email, password, fullName: firstName || undefined, acceptTerms: accept });
    if (error) {
      setError(error);
      return;
    }
    toast({ title: "Account created", description: "Welcome to EDIO." });
    navigate("/account", { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Join EDIO"
      subtitle="Start with the essentials. You can complete delivery details later."
      footer={
        <>
          Already a member?{" "}
          <Link to="/login" className="text-primary hover:text-primary-glow smooth font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput
          label="First name"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Yousif"
          hint="Optional for now."
        />
        <AuthInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <AuthInput
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters. No shipping details needed yet."
        />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-[12px] text-muted-foreground leading-relaxed">
            I agree to EDIO's{" "}
            <Link to="/about" className="text-foreground hover:text-primary smooth">
              terms & privacy policy
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}

        <AuthButton loading={loading}>Create account</AuthButton>
      </form>
    </AuthLayout>
  );
};

export default Signup;
