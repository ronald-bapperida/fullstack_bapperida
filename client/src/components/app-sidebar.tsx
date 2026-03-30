import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator, SidebarMenuSub,
  SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  LayoutDashboard, Newspaper, Tag, Image, Menu, FileText,
  ClipboardList, BarChart2, Upload, MessageSquare, FileEdit,
  Users, LogOut, ChevronDown, Layers, FileType2, FolderOpen,
  AlertTriangle, FileQuestion,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useLang } from "@/contexts/language";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import logoBapperida from "@assets/logo_bapperida_1771921692764.png";
import logoKalteng from "@assets/logo_1771921695925.png";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_bpp: "Admin BAPPEDA",
  admin_rida: "Admin RIDA",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin_bpp: "bg-chart-2 text-white",
  admin_rida: "bg-chart-4 text-white",
};

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== "/" && loc.startsWith(href));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild data-active={active}>
        <Link href={href}>
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleNav({
  icon: Icon, label, basePath, children
}: { icon: any; label: string; basePath: string; children: React.ReactNode }) {
  const [loc] = useLocation();
  const isActive = loc.startsWith(basePath);
  const [open, setOpen] = useState(isActive);

  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton data-active={isActive && !open}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            <ChevronDown className={`ml-auto w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function SubNavItem({ href, label }: { href: string; label: string }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== "/" && loc.startsWith(href));
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild data-active={active}>
        <Link href={href}>{label}</Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const [logoutDialog, setLogoutDialog] = useState(false);

  if (!user) return null;

  const isBPP = user.role === "super_admin" || user.role === "admin_bpp";
  const isRIDA = user.role === "super_admin" || user.role === "admin_rida";

  return (
    <>
      <Sidebar>
        <SidebarHeader className="px-3 py-3">
          <div className="flex items-center gap-2">
            <img
              src={logoKalteng}
              alt="Logo Kalimantan Tengah"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold leading-tight">BAPPERIDA</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Kalimantan Tengah</span>
            </div>
            <img
              src={logoBapperida}
              alt="Logo BAPPERIDA"
              className="w-14 h-10 object-contain shrink-0"
            />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("general")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/" icon={LayoutDashboard} label={t("dashboard")} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isBPP && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("bappeda")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem href="/news" icon={Newspaper} label={t("news")} />
                  <NavItem href="/categories" icon={Tag} label={t("categories")} />
                  <NavItem href="/banners" icon={Image} label={t("banners")} />
                  <NavItem href="/menus" icon={Menu} label={t("menus")} />
                  <CollapsibleNav icon={FileText} label={t("ppidSection")} basePath="/documents">
                    <SubNavItem href="/documents" label={t("daftarDokumen")} />
                    <SubNavItem href="/documents/kinds" label={t("docKinds")} />
                    <SubNavItem href="/documents/categories" label={t("docCategories")} />
                    <SubNavItem href="/documents/types" label={t("docTypes")} />
                  </CollapsibleNav>
                  <CollapsibleNav icon={AlertTriangle} label={t("layananInformasi")} basePath="/ppid">
                    <SubNavItem href="/ppid/information-requests" label={t("permohonanInformasi")} />
                    <SubNavItem href="/ppid/objections" label={t("keberatan")} />
                  </CollapsibleNav>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isRIDA && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("rida")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem href="/permits" icon={ClipboardList} label={t("permits")} />
                  <NavItem href="/surveys" icon={BarChart2} label={t("surveys")} />
                  <NavItem href="/final-reports" icon={Upload} label={t("reports")} />
                  <NavItem href="/suggestions" icon={MessageSquare} label={t("suggestions")} />
                  <NavItem href="/letter-templates" icon={FileEdit} label={t("templates")} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {user.role === "super_admin" && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("administration")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem href="/users" icon={Users} label={t("users")} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
                {user.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{user.fullName}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 w-fit mt-0.5 ${ROLE_COLORS[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setLogoutDialog(true)}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            {t("logout")}
          </Button>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={logoutDialog} onOpenChange={setLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logoutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("logoutConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { logout(); setLogoutDialog(false); }}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
