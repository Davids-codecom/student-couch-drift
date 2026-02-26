import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import TermsDialog from "@/components/TermsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSession } from "@/hooks/useSession";
import { upsertUserProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabaseClient";
import useIridescenceEnabled from "@/hooks/useIridescenceEnabled";

const Iridescence = lazy(() => import("@/components/Iridescence"));

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900/40";

const authKeyframes = `
  @keyframes auroraFloat {
    0% { transform: translate3d(0,0,0) scale(1); }
    50% { transform: translate3d(0,-18px,0) scale(1.05); }
    100% { transform: translate3d(0,0,0) scale(1); }
  }

  @keyframes softDrift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

const floatingOrbs = [
  { top: "10%", left: "5%", size: 220, opacity: 0.35, delay: "0s" },
  { top: "60%", left: "70%", size: 260, opacity: 0.25, delay: "-3s" },
  { top: "75%", left: "20%", size: 180, opacity: 0.3, delay: "-5s" },
] as const;

const UNIVERSITY_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const APPROVED_UNIVERSITY_DOMAINS = new Set([
  "edu",
  "unil.ch",
  "unige.ch",
  "hsg.ch",
  "unibe.ch",
  "ethz.ch",
  "epfl.ch",
  "uzh.ch",
]);

const detectRecoveryRequest = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
  return (
    searchParams.get("recovery") === "1"
    || searchParams.get("type") === "recovery"
    || hashParams.get("recovery") === "1"
    || hashParams.get("type") === "recovery"
  );
};

const clearRecoveryUrlState = () => {
  if (typeof window === "undefined") {
    return;
  }
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("recovery");
  nextUrl.searchParams.delete("type");
  nextUrl.searchParams.delete("code");
  nextUrl.searchParams.delete("token_hash");
  nextUrl.searchParams.delete("error");
  nextUrl.searchParams.delete("error_code");
  nextUrl.searchParams.delete("error_description");
  nextUrl.hash = "";
  window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}`);
};

const detectRequestedAuthMode = (): "signin" | "signup" | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "signup" || mode === "signin") {
    return mode;
  }
  return null;
};

const isUniversityEmail = (email: string) => {
  if (!UNIVERSITY_EMAIL_REGEX.test(email)) {
    return false;
  }
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return [...APPROVED_UNIVERSITY_DOMAINS].some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
};

const deriveNameFromUniversityEmail = (email: string) => {
  const localPart = email.split("@")[0] ?? "";
  const rawSegments = localPart
    .replace(/[^a-zA-Z.\-_]/g, " ")
    .split(/[.\-_ ]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const cleanedSegments = rawSegments.length > 0 ? rawSegments : ["Student"];
  const toTitleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const firstName = toTitleCase(cleanedSegments[0]);
  const lastName = cleanedSegments[1] ? toTitleCase(cleanedSegments[1]) : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return { firstName, lastName, fullName: fullName || "Student" };
};

const getAuthEmailRedirect = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return undefined;
  }

  return `${window.location.origin}/auth`;
};

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, loading, signOut } = useSession();
  const { refreshUser } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState<"renter" | "host">("renter");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const effectsEnabled = useIridescenceEnabled();

  const greeting = useMemo(() => (mode === "signin" ? "Welcome back" : ""), [mode]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
  };

  const handleForgotPassword = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Enter your email first, then tap Forgot password.");
      return;
    }

    setSendingReset(true);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth?recovery=1` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) {
        throw error;
      }

      setStatusMessage("Password reset link sent. Check your inbox.");
      toast({
        title: "Reset email sent",
        description: "Open the link in your inbox to create a new password.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset email.";
      setErrorMessage(message);
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendVerification = useCallback(async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const targetEmail = (pendingVerificationEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage("Enter your university email, then resend verification.");
      return;
    }

    if (!isUniversityEmail(targetEmail)) {
      setErrorMessage("Use your university email to resend verification.");
      return;
    }

    setResendingVerification(true);
    try {
      const redirectTo = getAuthEmailRedirect();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) {
        throw error;
      }

      setPendingVerificationEmail(targetEmail);
      setStatusMessage(`Verification email resent to ${targetEmail}.`);
      toast({
        title: "Verification resent",
        description: "Check inbox and spam folders.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to resend verification email.";
      setErrorMessage(message);
    } finally {
      setResendingVerification(false);
    }
  }, [email, pendingVerificationEmail, toast]);

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const trimmedPassword = newPassword.trim();
    if (trimmedPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (trimmedPassword !== confirmPassword.trim()) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });
      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      await refreshUser();
      clearRecoveryUrlState();
      setIsRecoveryMode(false);
      setMode("signin");
      setNewPassword("");
      setConfirmPassword("");
      setStatusMessage("Password updated. Sign in with your new password.");
      toast({ title: "Password updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password.";
      setErrorMessage(message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const typedPassword = password.trim();

    try {
      if (mode === "signup") {
        if (typedPassword.length < 6) {
          setErrorMessage("Password must be at least 6 characters long.");
          return;
        }

        if (!acceptedTerms) {
          setErrorMessage("Accept the terms and conditions to continue.");
          return;
        }

        if (!isUniversityEmail(normalizedEmail)) {
          setErrorMessage("Use your university email to create an account.");
          return;
        }

        const derivedName = deriveNameFromUniversityEmail(normalizedEmail);

        const signUpOptions: {
          data: { full_name: string; first_name: string; last_name: string | null; user_role: string };
          emailRedirectTo?: string;
        } = {
          data: {
            full_name: derivedName.fullName,
            first_name: derivedName.firstName,
            last_name: derivedName.lastName || null,
            user_role: userRole,
          },
        };

        const redirectTo = getAuthEmailRedirect();
        if (redirectTo) {
          signUpOptions.emailRedirectTo = redirectTo;
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: typedPassword,
          options: signUpOptions,
        });

        if (error) {
          throw error;
        }

        const newUser = data.user;
        if (newUser) {
          await upsertUserProfile({
            id: newUser.id,
            email: newUser.email ?? normalizedEmail,
            full_name: derivedName.fullName,
            user_role: userRole,
            avatar_url: null,
            bio: null,
            student_id_url: null,
            university: null,
            program_name: null,
            program_year: null,
            program_type: null,
          });
        }

        await refreshUser();
        setMode("signin");
        setPassword("");
        setPendingVerificationEmail(normalizedEmail);
        setStatusMessage("Check your inbox, verify your university email, then sign in.");
        toast({
          title: "Verify your university email",
          description: "We sent a confirmation link. If it does not arrive, use Resend verification.",
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: typedPassword,
      });
      if (error) {
        throw error;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setErrorMessage("Verify your university email before signing in.");
        return;
      }

      await refreshUser();
      setStatusMessage("Signed in successfully.");
      toast({ title: "Signed in" });
      navigate("/listings", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("email not confirmed")) {
        setErrorMessage("Verify your university email before signing in.");
        return;
      }
      if (normalizedMessage.includes("database error saving new user")) {
        setErrorMessage("Account setup is blocked by legacy data for this email. Contact support to clear it.");
        return;
      }
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && user && !isRecoveryMode) {
      navigate("/listings", { replace: true });
    }
  }, [isRecoveryMode, loading, user, navigate]);

  useEffect(() => {
    const requestedMode = detectRequestedAuthMode();
    const recovery = detectRecoveryRequest();

    if (recovery) {
      setIsRecoveryMode(true);
      setMode("signin");
      setStatusMessage("Create your new password.");
      setErrorMessage(null);
    } else if (requestedMode) {
      setMode(requestedMode);
      setStatusMessage(null);
      setErrorMessage(null);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && detectRecoveryRequest())) {
        setIsRecoveryMode(true);
        setMode("signin");
        setStatusMessage("Create your new password.");
        setErrorMessage(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [location.search]);

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f6f8fb] via-[#edf2f7] to-[#f8fafc]">
        {effectsEnabled && (
          <Suspense fallback={null}>
            <Iridescence
              color={[1.2, 1.35, 1.5]}
              mouseReact={false}
              amplitude={0.4}
              speed={1.2}
              className="pointer-events-none"
            />
          </Suspense>
        )}
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f6f8fb] via-[#edf2f7] to-[#f8fafc] text-slate-900">
      <style>{authKeyframes}</style>
      {effectsEnabled && (
        <Suspense fallback={null}>
          <Iridescence
            color={[1.4, 1.15, 1.65]}
            mouseReact
            amplitude={0.4}
            speed={1.2}
            className="pointer-events-none opacity-70 mix-blend-screen"
          />
        </Suspense>
      )}
      <div className="pointer-events-none absolute inset-0">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "linear-gradient(130deg, rgba(226,232,240,0.45), rgba(241,245,249,0.55), rgba(203,213,225,0.35))",
            backgroundSize: "200% 200%",
            animation: "softDrift 36s ease-in-out infinite",
          }}
        />
        {floatingOrbs.map((orb) => (
          <span
            key={`${orb.top}-${orb.left}`}
            className="absolute rounded-full bg-gradient-to-br from-white/85 via-slate-100/80 to-slate-200/50"
            style={{
              top: orb.top,
              left: orb.left,
              width: orb.size,
              height: orb.size,
              opacity: orb.opacity,
              animation: "auroraFloat 20s ease-in-out infinite",
              animationDelay: orb.delay,
            }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="relative rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                {greeting && (
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{greeting}</p>
                )}
                <CardTitle className="text-3xl mt-1">{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {mode === "signin"
                    ? "Enter your credentials to pick up where you left off."
                    : "Sign up with your university email. We verify the email and auto-fill your name from it."}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {(["signin", "signup"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                      mode === value
                        ? "bg-slate-900 text-white shadow-lg"
                        : "border border-slate-200 text-slate-500 hover:border-slate-400"
                    } ${focusRing}`}
                  >
                    {value === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>
            </div>

            {isRecoveryMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11 rounded-2xl border-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11 rounded-2xl border-slate-200 bg-white/80"
                  />
                </div>

                <Button
                  type="submit"
                  className={`w-full rounded-full py-2.5 text-sm sm:py-3 sm:text-base ${focusRing}`}
                  disabled={updatingPassword}
                >
                  {updatingPassword ? "Updating..." : "Update password"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-full"
                  disabled={updatingPassword}
                  onClick={() => {
                    clearRecoveryUrlState();
                    setIsRecoveryMode(false);
                    setStatusMessage(null);
                    setErrorMessage(null);
                  }}
                >
                  Back to sign in
                </Button>

                <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Secure password recovery
                  </div>
                </div>

                {statusMessage && <p className="text-sm text-emerald-600 text-center">{statusMessage}</p>}
                {errorMessage && <p className="text-sm text-rose-500 text-center">{errorMessage}</p>}
              </form>
            ) : user ? (
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
                <p className="text-sm">
                  Signed in as <span className="font-semibold">{user.email}</span>
                </p>
                <Button onClick={handleSignOut} variant="destructive" className={`w-full ${focusRing}`}>
                  Sign out
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={mode === "signup" ? "you@university.edu" : "you@example.com"}
                    required
                    className="h-11 rounded-2xl border-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11 rounded-2xl border-slate-200 bg-white/80"
                  />
                </div>
                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={sendingReset || submitting}
                      className="text-xs font-semibold text-slate-600 underline underline-offset-4 transition hover:text-slate-900 disabled:opacity-60"
                    >
                      {sendingReset ? "Sending reset link..." : "Forgot password?"}
                    </button>
                  </div>
                )}

                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification || submitting}
                      className="text-xs font-semibold text-slate-600 underline underline-offset-4 transition hover:text-slate-900 disabled:opacity-60"
                    >
                      {resendingVerification ? "Resending verification..." : "Resend verification email"}
                    </button>
                  </div>
                )}

                {mode === "signup" && (
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-blue-50/40 p-4">
                    <p className="text-sm text-slate-600">
                      Use your university email. First and last name are generated from the email address.
                    </p>

                    <div className="space-y-2">
                      <Label>User role</Label>
                      <RadioGroup
                        value={userRole}
                        onValueChange={(value) => setUserRole(value as "renter" | "host")}
                        className="flex gap-3 rounded-full bg-white/70 p-1"
                      >
                        {[
                          { id: "role-renter", label: "Renter", value: "renter" },
                          { id: "role-host", label: "Host", value: "host" },
                        ].map((option) => (
                          <div key={option.value} className="flex flex-1 items-center justify-center">
                            <RadioGroupItem
                              value={option.value}
                              id={option.id}
                              className="peer sr-only"
                              aria-label={option.label}
                            />
                            <label
                              htmlFor={option.id}
                              className={`w-full cursor-pointer rounded-full px-3 py-2 text-center text-sm font-medium transition ${
                                userRole === option.value ? "bg-slate-900 text-white" : "text-slate-500"
                              }`}
                            >
                              {option.label}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                  </div>
                )}

                {mode === "signup" && (
                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(value) => setAcceptedTerms(Boolean(value))} />
                      <label htmlFor="terms" className="text-xs">
                        I agree to the <span className="font-semibold">Couch-Share.com Terms &amp; Conditions</span>.{" "}
                        <TermsDialog />
                      </label>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className={`w-full rounded-full py-2.5 text-sm sm:py-3 sm:text-base ${focusRing}`}
                  disabled={submitting}
                >
                  {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>

                <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Encrypted authentication · No spam
                  </div>
                </div>

                {statusMessage && <p className="text-sm text-emerald-600 text-center">{statusMessage}</p>}
                {errorMessage && <p className="text-sm text-rose-500 text-center">{errorMessage}</p>}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Auth;
