import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLang } from "@/contexts/language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import logoBapperida from "@assets/logo_bapperida.png";
import logoPpid from "@assets/logo_ppid.png";
import logoKalteng from "@assets/logo_kalteng.png";

export default function LoginPage() {
  const [, setLoc] = useLocation();
  const { login } = useAuth();
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      setLoc("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center justify-center gap-4 rounded-xl text-primary-foreground">
            <img
              src={logoKalteng}
              alt="Logo Kalteng"
              className="h-[120px] object-contain shrink-0"
            />
            <img
              src={logoBapperida}
              alt="Logo BAPPERIDA"
              className="h-[120px] object-contain shrink-0"
            />
            <div className="w-px h-12 bg-border" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Portal Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">BAPPERIDA Kalimantan Tengah</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("loginTitle")}</CardTitle>
            <CardDescription>{t("loginDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{t("loginUsername")}</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="superadmin"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("loginPassword")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 mt-1" disabled={loading} data-testid="button-login">
                <LogIn className="w-4 h-4" />
                {loading ? t("loginProcessing") : t("loginSubmit")}
              </Button>
              <div className="text-center">
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline" data-testid="link-forgot-password">
                  Lupa Password?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
