import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { fetchUserProfile, upsertUserProfile, type ProgramType, type UserRole } from "@/lib/profile";
import { supabase } from "@/lib/supabaseClient";
import { uploadStudentId } from "@/lib/studentId";
import { filterUniversities } from "@/lib/universities";

interface FormState {
  fullName: string;
  userRole: UserRole;
  avatarUrl: string;
  bio: string;
  university: string;
  programName: string;
  programYear: string;
  programType: ProgramType | "";
  studentIdUrl: string;
  payoutAccountHolder: string;
  payoutAccountNumber: string;
  payoutBankName: string;
  payoutBankCountry: string;
}

const PROGRAM_TYPE_OPTIONS: Array<{ value: ProgramType; label: string }> = [
  { value: "bsc", label: "Bachelor (BSc)" },
  { value: "msc", label: "Master (MSc)" },
  { value: "phd", label: "Doctorate (PhD)" },
  { value: "other", label: "Other program" },
];

const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  bsc: "Bachelor (BSc)",
  msc: "Master (MSc)",
  phd: "Doctorate (PhD)",
  other: "Other program",
};

const PROGRAM_YEAR_OPTIONS = ["1", "2", "3", "4", "5"];

const PROFILE_PHOTO_BUCKET = "couch-photos";

const generateFileName = (file: File) => {
  const ext = file.name.split(".").pop();
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${random}${ext ? `.${ext}` : ""}`;
};

const uploadProfilePhoto = async (userId: string, file: File) => {
  const fileName = generateFileName(file);
  const filePath = `avatars/${userId}/${fileName}`;
  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    throw new Error(error.message ?? "Failed to upload profile photo.");
  }

  const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to fetch uploaded profile photo URL.");
  }
  return data.publicUrl;
};

const ProfileSettings = () => {
  const { profile, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    fullName: "",
    userRole: "renter",
    avatarUrl: "",
    bio: "",
    university: "",
    programName: "",
    programYear: "",
    programType: "",
    studentIdUrl: "",
    payoutAccountHolder: "",
    payoutAccountNumber: "",
    payoutBankName: "",
    payoutBankCountry: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const photoPreviewObjectUrlRef = useRef<string | null>(null);

  const email = profile?.email ?? "";
  const roleLocked = Boolean(profile?.user_role);

  useEffect(() => {
    const loadProfile = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const remote = await fetchUserProfile(profile.id).catch(() => null);
        const resolvedProgramYear = remote?.program_year ?? profile.program_year ?? null;
        const next: FormState = {
          fullName: remote?.full_name ?? profile.full_name ?? "",
          userRole: remote?.user_role ?? profile.user_role ?? "renter",
          avatarUrl: remote?.avatar_url ?? profile.avatar_url ?? "",
          bio: remote?.bio ?? "",
          university: remote?.university ?? profile.university ?? "",
          programName: remote?.program_name ?? profile.program_name ?? "",
          programYear: resolvedProgramYear ? String(resolvedProgramYear) : "",
          programType: remote?.program_type ?? profile.program_type ?? "",
          studentIdUrl: remote?.student_id_url ?? profile.student_id_url ?? "",
          payoutAccountHolder: remote?.payout_account_holder ?? profile.payout_account_holder ?? "",
          payoutAccountNumber: remote?.payout_account_number ?? profile.payout_account_number ?? "",
          payoutBankName: remote?.payout_bank_name ?? profile.payout_bank_name ?? "",
          payoutBankCountry: remote?.payout_bank_country ?? profile.payout_bank_country ?? "",
        };
        setForm(next);
        setPhotoPreview(next.avatarUrl ?? "");
        setProfilePhotoFile(null);
        if (photoPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(photoPreviewObjectUrlRef.current);
          photoPreviewObjectUrlRef.current = null;
        }
      } catch (error) {
        console.warn("Failed to fetch profile", error);
        if (profile.full_name || profile.avatar_url) {
          setForm({
            fullName: profile.full_name ?? "",
            userRole: profile.user_role ?? "renter",
            avatarUrl: profile.avatar_url ?? "",
            bio: profile.bio ?? "",
            university: profile.university ?? "",
            programName: profile.program_name ?? "",
            programYear: profile.program_year ? String(profile.program_year) : "",
            programType: profile.program_type ?? "",
            studentIdUrl: profile.student_id_url ?? "",
            payoutAccountHolder: profile.payout_account_holder ?? "",
            payoutAccountNumber: profile.payout_account_number ?? "",
            payoutBankName: profile.payout_bank_name ?? "",
            payoutBankCountry: profile.payout_bank_country ?? "",
          });
          setPhotoPreview(profile.avatar_url ?? "");
          setProfilePhotoFile(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [profile?.avatar_url, profile?.bio, profile?.full_name, profile?.id, profile?.user_role]);

  useEffect(() => {
    return () => {
      if (photoPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(photoPreviewObjectUrlRef.current);
      }
    };
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile) return true;
    return (
      (form.fullName ?? "") !== (profile.full_name ?? "") ||
      form.userRole !== (profile.user_role ?? "renter") ||
      (form.avatarUrl ?? "") !== (profile.avatar_url ?? "") ||
      (form.bio ?? "") !== (profile.bio ?? "") ||
      (form.university ?? "") !== (profile.university ?? "") ||
      (form.programName ?? "") !== (profile.program_name ?? "") ||
      (form.programYear ?? "") !== (profile.program_year ? String(profile.program_year) : "") ||
      (form.programType ?? "") !== (profile.program_type ?? "") ||
      (form.studentIdUrl ?? "") !== (profile.student_id_url ?? "") ||
      (form.payoutAccountHolder ?? "") !== (profile.payout_account_holder ?? "") ||
      (form.payoutAccountNumber ?? "") !== (profile.payout_account_number ?? "") ||
      (form.payoutBankName ?? "") !== (profile.payout_bank_name ?? "") ||
      (form.payoutBankCountry ?? "") !== (profile.payout_bank_country ?? "") ||
      Boolean(profilePhotoFile) ||
      Boolean(studentIdFile)
    );
  }, [form, profile, profilePhotoFile, studentIdFile]);

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
      let avatarUrlToSave = form.avatarUrl;
      if (profilePhotoFile) {
        avatarUrlToSave = await uploadProfilePhoto(profile.id, profilePhotoFile);
      }
      let studentIdUrlToSave = form.studentIdUrl;
      if (studentIdFile) {
        studentIdUrlToSave = await uploadStudentId(profile.id, studentIdFile);
      }

      const roleToPersist = roleLocked ? (profile.user_role ?? form.userRole) : form.userRole;
      const parsedProgramYear = form.programYear ? Number(form.programYear) : null;
      const safeProgramYear = parsedProgramYear && Number.isFinite(parsedProgramYear) ? parsedProgramYear : null;
      const trimmedUniversity = form.university.trim();
      const trimmedProgram = form.programName.trim();
      const payoutAccountHolder = form.payoutAccountHolder.trim();
      const payoutAccountNumber = form.payoutAccountNumber.trim();
      const payoutBankName = form.payoutBankName.trim();
      const payoutBankCountry = form.payoutBankCountry.trim();

      if (roleToPersist === "host") {
        if (!payoutAccountHolder || !payoutAccountNumber || !payoutBankName || !payoutBankCountry) {
          toast({
            title: "Add payout details",
            description: "Hosts need to provide all payout fields to receive Stripe transfers.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      const saved = await upsertUserProfile({
        id: profile.id,
        email: profile.email,
        full_name: form.fullName || null,
        user_role: roleToPersist,
        avatar_url: avatarUrlToSave || null,
        bio: form.bio ? form.bio.slice(0, 100) : null,
        student_id_url: studentIdUrlToSave || null,
        university: trimmedUniversity || null,
        program_name: trimmedProgram || null,
        program_year: safeProgramYear ?? null,
        program_type: form.programType || null,
        payout_account_holder: payoutAccountHolder || null,
        payout_account_number: payoutAccountNumber || null,
        payout_bank_name: payoutBankName || null,
        payout_bank_country: payoutBankCountry || null,
      });

      setForm({
        fullName: saved.full_name ?? "",
        userRole: saved.user_role,
        avatarUrl: saved.avatar_url ?? "",
        bio: saved.bio ?? "",
        university: saved.university ?? "",
        programName: saved.program_name ?? "",
        programYear: saved.program_year ? String(saved.program_year) : "",
        programType: saved.program_type ?? "",
        studentIdUrl: saved.student_id_url ?? "",
        payoutAccountHolder: saved.payout_account_holder ?? "",
        payoutAccountNumber: saved.payout_account_number ?? "",
        payoutBankName: saved.payout_bank_name ?? "",
        payoutBankCountry: saved.payout_bank_country ?? "",
      });
      setProfilePhotoFile(null);
      setStudentIdFile(null);
      if (photoPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(photoPreviewObjectUrlRef.current);
        photoPreviewObjectUrlRef.current = null;
      }
      setPhotoPreview(saved.avatar_url ?? "");

      await refreshUser();

      toast({
        title: "Profile updated",
        description: "Your information is now up to date.",
      });
    } catch (error) {
      console.error("Failed to update profile", error);
      toast({
        title: "Update failed",
        description: "We couldn't save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePhotoInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setProfilePhotoFile(file);
    if (photoPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(photoPreviewObjectUrlRef.current);
      photoPreviewObjectUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    photoPreviewObjectUrlRef.current = objectUrl;
    setPhotoPreview(objectUrl);
  };

  const handleStudentIdInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setStudentIdFile(file);
  };

  const resetStudentIdSelection = () => {
    setStudentIdFile(null);
  };

  const resetPhotoSelection = () => {
    if (photoPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(photoPreviewObjectUrlRef.current);
      photoPreviewObjectUrlRef.current = null;
    }
    setProfilePhotoFile(null);
    setPhotoPreview(form.avatarUrl || profile?.avatar_url || "");
  };

  const effectiveRole = roleLocked ? (profile?.user_role ?? form.userRole) : form.userRole;
  const roleLabel = effectiveRole === "host" ? "Host" : "Renter";
  const displayNameValue = (form.fullName?.trim() || profile?.full_name?.trim() || email || "Student").trim();
  const displayInitial = displayNameValue.charAt(0).toUpperCase() || "S";
  const completionBits = [
    Boolean(form.fullName?.trim()),
    Boolean(photoPreview),
    Boolean(form.bio?.trim()),
    Boolean(form.university?.trim()),
  ];
  const completionPercent = Math.round((completionBits.filter(Boolean).length / completionBits.length) * 100);
  const universitySuggestions = useMemo(() => filterUniversities(form.university), [form.university]);
  const programTypeLabel = form.programType ? PROGRAM_TYPE_LABELS[form.programType] : "Add your program";
  const programYearLabel = form.programYear ? `Year ${form.programYear}` : "Add your year";

  if (!profile) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Sign in to edit your profile.</p>
        <Button onClick={() => navigate("/auth")}>Go to sign in</Button>
      </main>
    );
  }

  return (
    <main className="dreamy-bg min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Button
          variant="ghost"
          className="w-fit rounded-full bg-white/70 px-4 py-2 text-sm text-slate-600 shadow-sm"
          onClick={() => navigate(-1)}
        >
          ← Back to dashboard
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          <div className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-2xl shadow-blue-100/50 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-white shadow-lg shadow-blue-100">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    onError={() => setPhotoPreview("")}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-200 to-indigo-300 text-2xl font-semibold text-white">
                    {displayInitial}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Profile overview</p>
                <h1 className="text-2xl font-semibold text-slate-900">{displayNameValue}</h1>
                <p className="text-sm text-slate-500">{email}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                <span>Profile completeness</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/70">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Finish your name, photo, and bio to help students recognize you faster.
              </p>
            </div>

            <dl className="mt-6 grid gap-4 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">User role</dt>
                  <dd className="text-base font-semibold text-slate-900">{roleLabel}</dd>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-500">
                  {roleLabel === "Host" ? "Hosting couches" : "Seeking couches"}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-400">University</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">
                  {form.university.trim() || "Add your university"}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Program</dt>
                <dd className="mt-1 space-y-1 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">{form.programName.trim() || "Add your program"}</p>
                  <p className="text-xs text-slate-500">
                    {form.programType ? programTypeLabel : "Choose program type"}
                    {" • "}
                    {form.programYear ? programYearLabel : "Select your year"}
                  </p>
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Student ID</dt>
                <dd className="mt-1 flex items-center justify-between text-sm text-slate-600">
                  <span>{form.studentIdUrl ? "Uploaded" : "Waiting for upload"}</span>
                  {form.studentIdUrl && (
                    <a
                      href={form.studentIdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-indigo-600 underline"
                    >
                      View
                    </a>
                  )}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Tips</dt>
                <dd className="mt-2 space-y-2 text-sm">
                  <p>• Add a friendly bio so hosts know how to welcome you.</p>
                  <p>• Upload a clear profile photo to build trust.</p>
                </dd>
              </div>
            </dl>
          </div>

          <Card className="rounded-[2rem] border border-white/70 bg-white/95 shadow-2xl shadow-blue-100/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-semibold text-slate-900">Edit your profile</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Update how other students see you. Your email stays the same for sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading your profile…</p>
              ) : (
                <form className="space-y-8" onSubmit={handleSubmit}>
                  <section className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Account</p>
                      <p className="text-sm text-slate-500">We use this info to keep your account secure.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={email} disabled className="bg-slate-50 text-slate-500" />
                      <p className="text-xs text-muted-foreground">Email can't be changed.</p>
                    </div>
                  </section>

                  {effectiveRole === "host" && (
                    <section className="space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Payout information</p>
                        <p className="text-sm text-slate-500">
                          Payment information stays private and is never shown to the public.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payoutAccountHolder">Account holder name</Label>
                        <Input
                          id="payoutAccountHolder"
                          value={form.payoutAccountHolder}
                          onChange={(event) => handleChange("payoutAccountHolder", event.target.value)}
                          placeholder="Name on bank account"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payoutAccountNumber">IBAN or account number</Label>
                        <Input
                          id="payoutAccountNumber"
                          value={form.payoutAccountNumber}
                          onChange={(event) => handleChange("payoutAccountNumber", event.target.value)}
                          placeholder="e.g. CH12 1234 5678 9012 3456 7"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payoutBankName">Bank name</Label>
                        <Input
                          id="payoutBankName"
                          value={form.payoutBankName}
                          onChange={(event) => handleChange("payoutBankName", event.target.value)}
                          placeholder="Bank where you receive payouts"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payoutBankCountry">Bank country</Label>
                        <Input
                          id="payoutBankCountry"
                          value={form.payoutBankCountry}
                          onChange={(event) => handleChange("payoutBankCountry", event.target.value)}
                          placeholder="Country where your bank is located"
                        />
                        <p className="text-xs text-slate-500">This helps Stripe route payouts to the right region.</p>
                      </div>
                    </section>
                  )}

                  <section className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Public profile</p>
                      <p className="text-sm text-slate-500">These details are visible when students connect with you.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input
                        id="fullName"
                        value={form.fullName}
                        placeholder="Your full name"
                        onChange={(event) => handleChange("fullName", event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>User type</Label>
                      {roleLocked ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{roleLabel}</p>
                          <p className="text-xs text-slate-500">Contact support if you need to change this later.</p>
                        </div>
                      ) : (
                        <RadioGroup
                          value={form.userRole}
                          onValueChange={(value) => handleChange("userRole", value as UserRole)}
                          className="flex flex-wrap gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                        >
                          <div className="flex items-center space-x-2 rounded-full bg-white px-3 py-2 shadow-sm">
                            <RadioGroupItem id="role-renter" value="renter" />
                            <Label htmlFor="role-renter" className="text-sm">
                              Renter
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 rounded-full bg-white px-3 py-2 shadow-sm">
                            <RadioGroupItem id="role-host" value="host" />
                            <Label htmlFor="role-host" className="text-sm">
                              Host
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="profilePhoto">Profile photo</Label>
                      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center">
                        <div className="h-16 w-16 overflow-hidden rounded-full border border-white shadow">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Profile preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-200 to-indigo-300 text-xl font-semibold text-white">
                              {displayInitial}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Input
                            id="profilePhoto"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoInput}
                            className="cursor-pointer bg-white"
                          />
                          <p className="text-xs text-slate-500">Upload a clear square image (PNG or JPG).</p>
                          {profilePhotoFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-0 text-xs text-slate-600"
                              onClick={resetPhotoSelection}
                            >
                              Remove selected photo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Student verification</p>
                        <p className="text-sm text-slate-500">Add your university details so hosts know you're an active student.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="university">University</Label>
                        <Input
                          id="university"
                          value={form.university}
                          onChange={(event) => handleChange("university", event.target.value)}
                          placeholder="Start typing your university name"
                          autoComplete="off"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                        {(() => {
                          const trimmed = form.university.trim();
                          if (!trimmed || !universitySuggestions.length) return null;
                          const exactMatch = universitySuggestions.some(
                            (option) => option.toLowerCase() === trimmed.toLowerCase(),
                          );
                          if (exactMatch && universitySuggestions.length === 1) {
                            return null;
                          }
                          return (
                            <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                              {universitySuggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50"
                                  onClick={() => handleChange("university", suggestion)}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="programName">Program name</Label>
                        <Input
                          id="programName"
                          value={form.programName}
                          onChange={(event) => handleChange("programName", event.target.value)}
                          placeholder="e.g. Computer Science"
                          className="h-11 rounded-2xl border-slate-200 bg-white"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Program type</Label>
                          <Select
                            value={form.programType}
                            onValueChange={(value) => handleChange("programType", value as ProgramType)}
                          >
                            <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROGRAM_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Year in program</Label>
                          <Select value={form.programYear} onValueChange={(value) => handleChange("programYear", value)}>
                            <SelectTrigger className="rounded-2xl border-slate-200 bg-white">
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROGRAM_YEAR_OPTIONS.map((year) => (
                                <SelectItem key={year} value={year}>
                                  Year {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="studentIdUpload">Student ID</Label>
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                          <Input
                            id="studentIdUpload"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleStudentIdInput}
                            className="cursor-pointer bg-white"
                          />
                          <p className="text-xs text-slate-500">Upload updated, new student ID.</p>
                          {studentIdFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-0 text-xs text-slate-600"
                              onClick={resetStudentIdSelection}
                            >
                              Remove selected document
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        rows={4}
                        value={form.bio}
                        placeholder="Share a bit about yourself"
                        maxLength={100}
                        onChange={(event) => handleChange("bio", event.target.value)}
                        className="rounded-2xl"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <p>Keep it friendly—other students will see this when they interact with you.</p>
                        <span>{form.bio.length}/100</span>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="outline" onClick={() => navigate(-1)} className="rounded-full px-6">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving || !hasChanges} className="rounded-full px-6">
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default ProfileSettings;
