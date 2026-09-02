import { useState } from "react";
import { authApi } from "../services/api";

const COLORS = { navy: "#081B3A", paperCard: "#FFFFFF", accent: "#2F6FED", ink: "#0E1E38", inkMuted: "#516179", line: "#D9E4F5", down: "#C23B32" };
const fontDisplay = "'Sora', system-ui, sans-serif";
const fontBody = "'IBM Plex Sans', system-ui, sans-serif";

export default function AuthForm({ mode, onAuthenticated, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (isSignup && name.trim().length < 2) return setError("Enter your name");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      const response = await (isSignup
        ? authApi.register({ name: name.trim(), email: email.trim(), password })
        : authApi.login({ email: email.trim(), password }));
      localStorage.setItem("stoclio_token", response.data.token);
      onAuthenticated(response.data.user);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", fontFamily: fontBody, fontSize: 14, padding: "11px 12px", borderRadius: 8, border: `1px solid ${error ? COLORS.down : COLORS.line}`, outline: "none" };
  return <div style={{ background: COLORS.navy, display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 20px" }}>
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: COLORS.paperCard, borderRadius: 16, padding: 28 }}>
      <div style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 20, color: COLORS.ink, marginBottom: 6 }}>{isSignup ? "Open your Stocro account" : "Log in to your account"}</div>
      <div style={{ fontFamily: fontBody, fontSize: 13, color: COLORS.inkMuted, marginBottom: 22 }}>{isSignup ? "Create your account with email and password." : "Use your Stoclio account credentials."}</div>
      {isSignup && <label style={{ display: "block", marginBottom: 14, fontFamily: fontBody, fontSize: 12.5, color: COLORS.inkMuted }}>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Rivera" autoComplete="name" style={{ ...inputStyle, marginTop: 6 }} /></label>}
      <label style={{ display: "block", marginBottom: 14, fontFamily: fontBody, fontSize: 12.5, color: COLORS.inkMuted }}>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" type="email" autoComplete="email" style={{ ...inputStyle, marginTop: 6 }} /></label>
      <label style={{ display: "block", marginBottom: error ? 8 : 18, fontFamily: fontBody, fontSize: 12.5, color: COLORS.inkMuted }}>Password<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" type="password" autoComplete={isSignup ? "new-password" : "current-password"} style={{ ...inputStyle, marginTop: 6 }} /></label>
      {error && <div role="alert" style={{ fontFamily: fontBody, fontSize: 12.5, color: COLORS.down, marginBottom: 14 }}>{error}</div>}
      <button type="submit" disabled={loading} style={{ width: "100%", fontFamily: fontBody, fontWeight: 600, fontSize: 14.5, color: "#fff", background: COLORS.accent, border: "none", borderRadius: 9, padding: "12px 0", cursor: loading ? "wait" : "pointer", marginBottom: 12 }}>{loading ? "Please wait..." : isSignup ? "Create account" : "Log in"}</button>
      <button type="button" onClick={onBack} style={{ width: "100%", fontFamily: fontBody, fontSize: 13.5, color: COLORS.inkMuted, background: "transparent", border: "none", cursor: "pointer" }}>Back to home</button>
    </form>
  </div>;
}
