import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { PageHead } from "@/components/PageHead";

interface BookingInfo {
  tenantName: string;
  tenantSlug: string;
  brandColor: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  jobTypes: string[];
  showDateField: boolean;
  thankYouMessage: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export function PublicBooking() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;

  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    jobType: "",
    preferredDate: "",
    description: "",
  });

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/v1/public/book/${encodeURIComponent(tenantSlug)}/info`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) { setInfo(data); setLoading(false); }
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [tenantSlug]);

  const brandColor = info?.primaryColor ?? info?.brandColor ?? "#1a1a1a";
  const accentColor = info?.accentColor ?? brandColor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState("submitting");
    setErrorMsg("");
    try {
      const body: Record<string, string | null> = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        jobType: form.jobType || null,
        preferredDate: form.preferredDate || null,
        description: form.description || null,
      };
      const r = await fetch(`/api/v1/public/book/${encodeURIComponent(tenantSlug!)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSubmitState("success");
      } else {
        const data = await r.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Something went wrong, please try again.");
        setSubmitState("error");
      }
    } catch {
      setErrorMsg("Network error, please try again.");
      setSubmitState("error");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9" }}>
        <p style={{ color: "#666", fontFamily: "sans-serif" }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9" }}>
        <div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a" }}>Booking unavailable</h1>
          <p style={{ color: "#666", marginTop: "0.5rem" }}>This booking page isn't available right now.</p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "0.6rem 0.75rem",
    border: "1px solid #d1d5db",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    background: "#fff",
    color: "#111",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.35rem",
    color: "#374151",
  };

  const fieldWrap: React.CSSProperties = { marginBottom: "1.1rem" };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <PageHead
        title={`Book Online — ${info.tenantName}`}
        description={`Book a job online with ${info.tenantName}. Choose your service, preferred date, and submit your details — we'll be in touch to confirm.`}
        noIndex={true}
      />
      <div style={{ background: brandColor, padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        {info.logoUrl && (
          <img src={info.logoUrl} alt={info.tenantName} style={{ height: "40px", objectFit: "contain" }} />
        )}
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {info.tenantName}
        </span>
      </div>

      <div style={{ maxWidth: "560px", margin: "2.5rem auto", padding: "0 1rem" }}>
        <div style={{ background: "#fff", padding: "2rem", borderTop: `4px solid ${brandColor}` }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem", color: "#111" }}>
            Book online
          </h1>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.75rem" }}>
            Fill in the form below and we'll get back to you as soon as possible.
          </p>

          {submitState === "success" ? (
            <div style={{ padding: "1.5rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "2px" }}>
              <p style={{ fontWeight: 700, color: "#166534", fontSize: "1rem", marginBottom: "0.25rem" }}>Enquiry received!</p>
              <p style={{ color: "#15803d", fontSize: "0.9rem" }}>{info.thankYouMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={fieldWrap}>
                <label style={labelStyle}>Full name *</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.1rem" }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    style={inputStyle}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    style={inputStyle}
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="07700 000000"
                  />
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Address</label>
                <input
                  style={inputStyle}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Job address (if applicable)"
                />
              </div>

              {info.jobTypes.length > 0 && (
                <div style={fieldWrap}>
                  <label style={labelStyle}>Job type</label>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={form.jobType}
                    onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                  >
                    <option value="">Select a job type…</option>
                    {info.jobTypes.map((jt) => (
                      <option key={jt} value={jt}>{jt}</option>
                    ))}
                  </select>
                </div>
              )}

              {info.showDateField && (
                <div style={fieldWrap}>
                  <label style={labelStyle}>Preferred date</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}

              <div style={fieldWrap}>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: "100px" }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tell us about the work needed…"
                  rows={4}
                />
              </div>

              {submitState === "error" && (
                <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={submitState === "submitting" || !form.name.trim()}
                style={{
                  width: "100%",
                  padding: "0.75rem 1.5rem",
                  background: submitState === "submitting" ? "#999" : brandColor,
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: submitState === "submitting" ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {submitState === "submitting" ? "Sending…" : "Send enquiry"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
