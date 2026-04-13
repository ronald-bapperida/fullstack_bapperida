import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { LanguageProvider, useLang } from "@/contexts/language";
import { ThemeProvider, useTheme } from "@/contexts/theme";
import { Button } from "@/components/ui/button";
import { useFcm } from "@/hooks/use-fcm";
import { Sun, Moon } from "lucide-react";

import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import Dashboard from "@/pages/dashboard";
import NewsPage from "@/pages/news/index";
import NewsFormPage from "@/pages/news/form";
import CategoriesPage from "@/pages/news/categories";
import BannersPage from "@/pages/banners/index";
import MenusPage from "@/pages/menus/index";
import DocumentsPage from "@/pages/documents/index";
import { DocKindsPage, DocCategoriesPage, DocTypesPage } from "@/pages/documents/masters";
import PermitsPage from "@/pages/permits/index";
import PermitDetailPage from "@/pages/permits/detail";
import SurveysPage from "@/pages/surveys/index";
import FinalReportsPage from "@/pages/reports/index";
import SuggestionsPage from "@/pages/suggestions/index";
import LetterTemplatesPage from "@/pages/letter-templates";
import LetterTemplatesCreatePage from "@/pages/letter-templates/new";
import LetterTemplatesEditPage from "@/pages/letter-templates/[id]/edit";
import LetterTemplatesPreviewPage from "@/pages/letter-templates/[id]/index";
import UsersPage from "@/pages/users/index";
import PushNotificationPage from "@/pages/push-notification";
import DocumentRequestsPage from "@/pages/document-requests/index";
import DocumentRequestDetailPage from "@/pages/document-requests/detail";
import PpidObjectionsPage from "@/pages/ppid/objections/index";
import PpidObjectionDetailPage from "@/pages/ppid/objections/[id]";
import PpidInfoRequestsPage from "@/pages/ppid/information-requests/index";
import PpidInfoRequestDetailPage from "@/pages/ppid/information-requests/[id]";
import NotFound from "@/pages/not-found";

const sidebarStyle = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "3.5rem",
} as React.CSSProperties;

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      onClick={toggleTheme}
      title={theme === "dark" ? t("lightMode") : t("darkMode")}
      data-testid="button-theme-toggle"
    >
      {theme === "dark"
        ? <Sun className="w-4 h-4" />
        : <Moon className="w-4 h-4" />
      }
    </Button>
  );
}

function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 ml-1">
      <Button
        size="sm"
        variant={lang === "id" ? "default" : "ghost"}
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setLang("id")}
        data-testid="button-lang-id"
      >
        🇮🇩 ID
      </Button>
      <Button
        size="sm"
        variant={lang === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setLang("en")}
        data-testid="button-lang-en"
      >
        🇬🇧 EN
      </Button>
    </div>
  );
}

function FcmSetup() {
  const { user } = useAuth();
  useFcm(user?.id);
  return null;
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <SidebarProvider style={sidebarStyle}>
      <FcmSetup />
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center h-12 px-4 border-b bg-background shrink-0 z-10 sticky top-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground hidden sm:block">{t("portal")}</span>
            <ThemeToggle />
            <LangSwitcher />
          </header>
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  const { t } = useLang();

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!user) return <Redirect to="/login" />;

  if (roles && !roles.includes(user.role)) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <h2 className="text-xl font-bold">{t("accessDenied")}</h2>
          <p className="text-muted-foreground">{t("accessDeniedDesc")}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/forgot-password">
        {user ? <Redirect to="/" /> : <ForgotPasswordPage />}
      </Route>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/news" component={() => <ProtectedRoute component={NewsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/news/create" component={() => <ProtectedRoute component={NewsFormPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/news/:id/edit" component={() => <ProtectedRoute component={NewsFormPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/categories" component={() => <ProtectedRoute component={CategoriesPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/banners" component={() => <ProtectedRoute component={BannersPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/menus" component={() => <ProtectedRoute component={MenusPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/documents/kinds" component={() => <ProtectedRoute component={DocKindsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/documents/categories" component={() => <ProtectedRoute component={DocCategoriesPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/documents/types" component={() => <ProtectedRoute component={DocTypesPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/permits" component={() => <ProtectedRoute component={PermitsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/permits/:id" component={() => <ProtectedRoute component={PermitDetailPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/surveys" component={() => <ProtectedRoute component={SurveysPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/final-reports" component={() => <ProtectedRoute component={FinalReportsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/suggestions" component={() => <ProtectedRoute component={SuggestionsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/letter-templates" component={() => <ProtectedRoute component={LetterTemplatesPage} roles={["super_admin", "admin_rida"]}/>} />
      <Route path="/letter-templates/new" component={() => <ProtectedRoute component={LetterTemplatesCreatePage} roles={["super_admin", "admin_rida"]}/>} />
      <Route path="/letter-templates/:id/edit" component={() => <ProtectedRoute component={LetterTemplatesEditPage} roles={["super_admin", "admin_rida"]}/>} />
      <Route path="/letter-templates/:id" component={() => <ProtectedRoute component={LetterTemplatesPreviewPage} roles={["super_admin", "admin_rida"]}/>} />
      <Route path="/push-notification" component={() => <ProtectedRoute component={PushNotificationPage} roles={["super_admin"]} />} />
      <Route path="/document-requests" component={() => <ProtectedRoute component={DocumentRequestsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/document-requests/:userId" component={() => <ProtectedRoute component={DocumentRequestDetailPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} roles={["super_admin"]} />} />
      <Route path="/ppid/objections" component={() => <ProtectedRoute component={PpidObjectionsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/ppid/objections/:id" component={() => <ProtectedRoute component={PpidObjectionDetailPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/ppid/information-requests" component={() => <ProtectedRoute component={PpidInfoRequestsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/ppid/information-requests/:id" component={() => <ProtectedRoute component={PpidInfoRequestDetailPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
