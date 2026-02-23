import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/auth";

import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import NewsPage from "@/pages/news/index";
import NewsFormPage from "@/pages/news/form";
import CategoriesPage from "@/pages/news/categories";
import BannersPage from "@/pages/banners/index";
import MenusPage from "@/pages/menus/index";
import DocumentsPage from "@/pages/documents/index";
import PermitsPage from "@/pages/permits/index";
import PermitDetailPage from "@/pages/permits/detail";
import SurveysPage from "@/pages/surveys/index";
import FinalReportsPage from "@/pages/reports/index";
import SuggestionsPage from "@/pages/suggestions/index";
import LetterTemplatesPage from "@/pages/letter-templates/index";
import UsersPage from "@/pages/users/index";
import NotFound from "@/pages/not-found";

const sidebarStyle = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "3.5rem",
} as React.CSSProperties;

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center h-12 px-4 border-b bg-background shrink-0 z-10 sticky top-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">Portal Admin BAPPERIDA Kalteng</span>
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
  const [loc] = useLocation();

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
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
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
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/news" component={() => <ProtectedRoute component={NewsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/news/create" component={() => <ProtectedRoute component={NewsFormPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/news/:id/edit" component={() => <ProtectedRoute component={NewsFormPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/categories" component={() => <ProtectedRoute component={CategoriesPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/banners" component={() => <ProtectedRoute component={BannersPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/menus" component={() => <ProtectedRoute component={MenusPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} roles={["super_admin", "admin_bpp"]} />} />
      <Route path="/permits" component={() => <ProtectedRoute component={PermitsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/permits/:id" component={() => <ProtectedRoute component={PermitDetailPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/surveys" component={() => <ProtectedRoute component={SurveysPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/final-reports" component={() => <ProtectedRoute component={FinalReportsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/suggestions" component={() => <ProtectedRoute component={SuggestionsPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/letter-templates" component={() => <ProtectedRoute component={LetterTemplatesPage} roles={["super_admin", "admin_rida"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} roles={["super_admin"]} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
