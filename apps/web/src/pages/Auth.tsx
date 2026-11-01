import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { UserDTO } from "@fashionos/shared";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field, Spinner } from "../components/ui";

function Shell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <Link to="/welcome" className="mb-8 text-center font-display text-3xl">fashionOS</Link>
      <h1 className="mb-6 text-center font-display text-2xl">{title}</h1>
      {children}
      {footer && <div className="mt-6 text-center text-sm text-stone-600">{footer}</div>}
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

const ErrorText = ({ text }: { text: string }) => (text ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p> : null);

export function Login() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api.post<{ user: UserDTO }>("/api/auth/login", { email, password });
      setUser(r.user);
      // PublicOnly koruyucusunun "/" yönlendirmesinden sonra çalışsın
      const to = (loc.state as any)?.from ?? "/";
      setTimeout(() => nav(to, { replace: true }), 0);
    });
  };
  return (
    <Shell title="Tekrar hoş geldin" footer={<>Hesabın yok mu? <Link className="font-medium underline" to="/register">Kayıt ol</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-posta"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Şifre"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorText text={error} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="text-paper" /> : "Giriş yap"}</button>
        <Link to="/forgot-password" className="block text-center text-sm text-stone-500 underline">Şifremi unuttum</Link>
      </form>
    </Shell>
  );
}

export function Register() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [kvkk, setKvkk] = useState(false);
  const { error, busy, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api.post<{ user: UserDTO }>("/api/auth/register", f);
      setUser(r.user);
      setTimeout(() => nav("/add?first=1", { replace: true }), 0);
    });
  };
  return (
    <Shell title="Gardırobunu oluştur" footer={<>Zaten hesabın var mı? <Link className="font-medium underline" to="/login">Giriş yap</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Adın"><input className="input" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="E-posta"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Şifre" hint="En az 8 karakter"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <label className="flex items-start gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} className="mt-0.5 accent-ink" required />
          Kişisel verilerimin (fotoğraflar ve gardırop bilgileri) yalnızca bana kombin önermek amacıyla işlenmesini kabul ediyorum. Verilerimi dilediğim an indirip silebilirim.
        </label>
        <ErrorText text={error} />
        <button className="btn-primary w-full" disabled={busy || !kvkk}>{busy ? <Spinner className="text-paper" /> : "Kayıt ol"}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { error, busy, run } = useSubmit();
  return (
    <Shell title="Şifreni sıfırla" footer={<Link className="underline" to="/login">Girişe dön</Link>}>
      {sent ? (
        <p className="card p-4 text-sm">Bu e-posta ile bir hesap varsa sıfırlama bağlantısı gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.post("/api/auth/forgot-password", { email });
              setSent(true);
            });
          }}
          className="space-y-4"
        >
          <Field label="E-posta"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <ErrorText text={error} />
          <button className="btn-primary w-full" disabled={busy}>Bağlantı gönder</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const { error, busy, run } = useSubmit();
  return (
    <Shell title="Yeni şifre belirle">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api.post("/api/auth/reset-password", { token: params.get("token"), password });
            await refresh();
            nav("/", { replace: true });
          });
        }}
        className="space-y-4"
      >
        <Field label="Yeni şifre" hint="En az 8 karakter"><input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorText text={error} />
        <button className="btn-primary w-full" disabled={busy}>Şifreyi kaydet</button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState<"busy" | "ok" | "err">("busy");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api
      .post("/api/auth/verify-email", { token: params.get("token") })
      .then(() => {
        setState("ok");
        refresh();
      })
      .catch((e) => {
        setState("err");
        setMsg(e.message);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell title="E-posta doğrulama" footer={<Link className="underline" to="/">Uygulamaya git</Link>}>
      <div className="card p-5 text-center text-sm">
        {state === "busy" && <Spinner className="mx-auto" />}
        {state === "ok" && "E-posta adresin doğrulandı. Teşekkürler!"}
        {state === "err" && msg}
      </div>
    </Shell>
  );
}
