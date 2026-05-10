"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Department, getCurrentUser, getDepartments, login, register } from "../lib/api";
import { setAccessToken } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("student.software@isu.local");
  const [password, setPassword] = useState("DevPassword123!");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [usernamePrefix, setUsernamePrefix] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const fixedDomain = "@isu.edu.tr";

  const normalizedPrefix = useMemo(
    () => usernamePrefix.trim().toLowerCase().replace(/\s+/g, ""),
    [usernamePrefix]
  );

  useEffect(() => {
    if (mode !== "register") {
      return;
    }

    if (departments.length > 0 || departmentsLoading) {
      return;
    }

    void loadDepartments();
  }, [mode, departments.length, departmentsLoading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data =
        mode === "login"
          ? await login(email.trim().toLowerCase(), password)
          : await submitRegister();
      setAccessToken(data.accessToken);
      const profile = await getCurrentUser();
      const needsOnboarding =
        profile.onboardingCompleted === false ||
        !profile.fullName?.trim() ||
        !profile.username?.trim() ||
        !profile.department?.id;
      router.push(needsOnboarding ? "/onboarding" : "/chat");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(resolveErrorMessage(message));
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    setDepartmentsLoading(true);
    try {
      const data = await getDepartments();
      setDepartments(data);
      if (!selectedDepartmentId && data[0]?.id) {
        setSelectedDepartmentId(data[0].id);
      }
    } catch {
      setError("Departments could not be loaded.");
    } finally {
      setDepartmentsLoading(false);
    }
  }

  async function submitRegister() {
    const prefixValidationError = validatePrefix(normalizedPrefix);
    if (prefixValidationError) {
      throw new Error(prefixValidationError);
    }

    if (!fullName.trim()) {
      throw new Error("Full name is required.");
    }

    if (registerPassword.trim().length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    if (!selectedDepartmentId) {
      throw new Error("Please select a department.");
    }

    return register({
      full_name: fullName.trim(),
      email: `${normalizedPrefix}${fixedDomain}`,
      password: registerPassword,
      department_id: selectedDepartmentId,
      username: normalizedPrefix
    });
  }

  function validatePrefix(value: string): string | null {
    if (!value) {
      return "Username is required.";
    }

    if (!/^[a-z0-9._]+$/.test(value)) {
      return "Use only lowercase letters, numbers, dots, and underscores.";
    }

    if (value.length < 3) {
      return "Username must be at least 3 characters.";
    }

    if (value.length > 30) {
      return "Username must be 30 characters or fewer.";
    }

    return null;
  }

  function resolveErrorMessage(message: string): string {
    if (!message) {
      return mode === "login" ? "Login failed. Check credentials." : "Registration failed.";
    }

    if (message.includes("Username is already in use")) {
      return "This username is already taken.";
    }

    if (message.includes("Email is already registered")) {
      return "This university email is already registered.";
    }

    if (message.includes("Department does not belong")) {
      return "Selected department is invalid.";
    }

    if (message.includes("@isu.edu.tr")) {
      return "Email must use the fixed @isu.edu.tr domain.";
    }

    if (message.includes("Selected school is invalid")) {
      return "Default university configuration is missing.";
    }

    if (message.includes("Password") || message.includes("at least 8 characters")) {
      return message;
    }

    return mode === "login" ? "Login failed. Check credentials." : "Registration failed.";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,128,176,0.3),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(56,128,176,0.16),_transparent_22%),linear-gradient(180deg,_#07111a_0%,_#0b1824_48%,_#08131d_100%)]" />
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(127,183,220,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(127,183,220,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute -left-24 top-20 h-56 w-56 rounded-full bg-[#3880b0]/16 blur-3xl" />
        <div className="absolute bottom-8 right-0 h-72 w-72 rounded-full bg-[#3880b0]/12 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="w-full rounded-[2rem] border border-[rgba(127,183,220,0.18)] bg-[linear-gradient(180deg,rgba(18,35,51,0.96),rgba(12,24,37,0.94))] p-6 shadow-[0_24px_90px_rgba(5,12,18,0.55)] backdrop-blur"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#7fb7dc]">Isu University Network</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {mode === "login" ? "IsuChat Login" : "IsuChat Register"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {mode === "login"
                  ? "Campus communication, materials, and realtime messaging in one place."
                  : "Create your university account with the fixed institutional email format."}
              </p>
            </div>
            <div className="flex rounded-full border border-[rgba(127,183,220,0.24)] bg-[rgba(8,19,29,0.86)] p-1 text-sm shadow-[inset_0_0_0_1px_rgba(56,128,176,0.08)]">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`rounded-full px-4 py-2 transition ${
                  mode === "login"
                    ? "bg-[#3880b0] font-medium text-[#08131d] shadow-[0_8px_24px_rgba(56,128,176,0.35)]"
                    : "text-slate-300"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`rounded-full px-4 py-2 transition ${
                  mode === "register"
                    ? "bg-[#3880b0] font-medium text-[#08131d] shadow-[0_8px_24px_rgba(56,128,176,0.35)]"
                    : "text-slate-300"
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {mode === "login" ? (
            <>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm text-slate-300">Email</span>
                <input
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)] px-4 py-3 outline-none ring-[#3880b0] transition focus:border-[rgba(127,183,220,0.4)] focus:ring-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)] px-4 py-3 outline-none ring-[#3880b0] transition focus:border-[rgba(127,183,220,0.4)] focus:ring-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm text-slate-300">Full name</span>
                <input
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)] px-4 py-3 outline-none ring-[#3880b0] transition focus:border-[rgba(127,183,220,0.4)] focus:ring-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  type="text"
                  required
                />
              </label>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm text-slate-300">University email</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)]">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 lowercase outline-none ring-[#3880b0] focus:ring-2"
                    value={usernamePrefix}
                    onChange={(e) =>
                      setUsernamePrefix(e.target.value.trim().toLowerCase().replace(/\s+/g, ""))
                    }
                    placeholder="halid.hocaoglu"
                    type="text"
                    required
                  />
                  <span className="border-l border-[rgba(127,183,220,0.18)] bg-[rgba(56,128,176,0.08)] px-4 py-3 text-sm font-medium text-[#7fb7dc]">
                    {fixedDomain}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Only letters, numbers, dots, and underscores are allowed.
                </p>
              </label>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm text-slate-300">Department</span>
                <select
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)] px-4 py-3 outline-none ring-[#3880b0] transition focus:border-[rgba(127,183,220,0.4)] focus:ring-2"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  required
                >
                  <option value="">
                    {departmentsLoading ? "Loading departments..." : "Select department"}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-5 block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.18)] bg-[rgba(5,14,24,0.92)] px-4 py-3 outline-none ring-[#3880b0] transition focus:border-[rgba(127,183,220,0.4)] focus:ring-2"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  type="password"
                  required
                />
              </label>
            </>
          )}
          {error ? (
            <p className="mb-4 rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#3880b0] px-4 py-3 font-medium text-[#08131d] shadow-[0_14px_34px_rgba(56,128,176,0.34)] transition hover:bg-[#4c90bd] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Registering..."
              : mode === "login"
                ? "Login"
                : "Register"}
          </button>
        </form>
      </div>
    </main>
  );
}
