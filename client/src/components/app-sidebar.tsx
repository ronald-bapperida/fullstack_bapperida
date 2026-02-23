import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Newspaper, Tag, Image, Menu, FileText,
  ClipboardList, BarChart2, Upload, MessageSquare, FileEdit,
  Users, LogOut, Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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

export function AppSidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isBPP = user.role === "super_admin" || user.role === "admin_bpp";
  const isRIDA = user.role === "super_admin" || user.role === "admin_rida";

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-tight truncate">BAPPERIDA</span>
            <span className="text-xs text-muted-foreground truncate">Kalimantan Tengah</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Umum</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isBPP && (
          <SidebarGroup>
            <SidebarGroupLabel>BAPPEDA</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/news" icon={Newspaper} label="Berita" />
                <NavItem href="/categories" icon={Tag} label="Kategori Berita" />
                <NavItem href="/banners" icon={Image} label="Banner" />
                <NavItem href="/menus" icon={Menu} label="Menus" />
                <NavItem href="/documents" icon={FileText} label="Dokumen PPID" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isRIDA && (
          <SidebarGroup>
            <SidebarGroupLabel>RIDA</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/permits" icon={ClipboardList} label="Izin Penelitian" />
                <NavItem href="/surveys" icon={BarChart2} label="Survei IKM" />
                <NavItem href="/final-reports" icon={Upload} label="Laporan Akhir" />
                <NavItem href="/suggestions" icon={MessageSquare} label="Kotak Saran" />
                <NavItem href="/letter-templates" icon={FileEdit} label="Template Surat" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user.role === "super_admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrasi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/users" icon={Users} label="Manajemen User" />
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
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={logout} data-testid="button-logout">
          <LogOut className="w-4 h-4" />
          Keluar
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
