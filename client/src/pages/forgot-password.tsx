import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, KeyRound, MailCheck, RefreshCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoBapperida from "@assets/logo_bapperida_1771921692764.png";
import { useToast } from "@/hooks/use-toast";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Gagal mengirim OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-otp", { email, otp });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP tidak valid");
      setResetToken(data.reset_token);
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "OTP tidak valid");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Password dan konfirmasi tidak sama");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { reset_token: resetToken, new_password: newPassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mereset password");
      setStep("done");
      toast({ title: "Password berhasil direset", description: "Silakan login dengan password baru Anda" });
    } catch (err: any) {
      setError(err.message || "Gagal mereset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <img src={logoBapperida} alt="Logo BAPPERIDA" className="object-contain shrink-0 h-16" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
            <p className="text-muted-foreground text-sm mt-1">BAPPERIDA Kalimantan Tengah</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {step === "email" && "Lupa Password"}
              {step === "otp" && "Verifikasi OTP"}
              {step === "reset" && "Password Baru"}
              {step === "done" && "Selesai"}
            </CardTitle>
            <CardDescription>
              {step === "email" && "Masukkan email akun Anda untuk menerima kode OTP"}
              {step === "otp" && `Kode OTP telah dikirim ke ${email}. Berlaku 10 menit.`}
              {step === "reset" && "Buat password baru untuk akun Anda"}
              {step === "done" && "Password Anda telah berhasil direset"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@bapperida.go.id"
                    required
                    data-testid="input-email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-otp">
                  <MailCheck className="w-4 h-4 mr-2" />
                  {loading ? "Mengirim OTP..." : "Kirim Kode OTP"}
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="otp">Kode OTP (6 digit)</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    data-testid="input-otp"
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-verify-otp">
                  {loading ? "Memverifikasi..." : "Verifikasi OTP"}
                </Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1"
                  onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                >
                  <RefreshCcw className="w-3 h-3" /> Kirim ulang OTP
                </button>
              </form>
            )}

            {step === "reset" && (
              <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">Password Baru</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    data-testid="input-new-password"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-reset-password">
                  {loading ? "Mereset..." : "Reset Password"}
                </Button>
              </form>
            )}

            {step === "done" && (
              <div className="flex flex-col gap-4 items-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <KeyRound className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Password Anda telah berhasil diubah. Silakan login dengan password baru.
                </p>
                <Button className="w-full" onClick={() => setLocation("/login")} data-testid="button-back-to-login">
                  Kembali ke Login
                </Button>
              </div>
            )}

            {step !== "done" && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                  onClick={() => setLocation("/login")}
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="w-3 h-3" /> Kembali ke Login
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
