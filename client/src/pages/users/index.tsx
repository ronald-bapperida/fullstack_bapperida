import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Users, ShieldCheck, UserCog, UserCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_bpp: "Admin BAPPEDA",
  admin_rida: "Admin RIDA",
};
const ROLE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin_bpp: "secondary",
  admin_rida: "outline",
};

interface UserData {
  id: string; username: string; email: string; fullName: string;
  role: string; isActive: boolean; createdAt: string;
}

function UserForm({ user, defaultRole, onDone }: { user?: UserData; defaultRole?: string; onDone: () => void }) {
  const { toast } = useToast();
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      fullName: user?.fullName || "",
      role: user?.role || defaultRole || "admin_bpp",
      isActive: user?.isActive ?? true,
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      const res = user
        ? await apiRequest("PATCH", `/api/admin/users/${user.id}`, payload)
        : await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: user ? "User diupdate" : "User dibuat" });
      onDone();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Nama Lengkap *</Label>
        <Input {...register("fullName", { required: true })} placeholder="John Doe" data-testid="input-fullname" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Username *</Label>
          <Input {...register("username", { required: true })} placeholder="johndoe" data-testid="input-username" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Email *</Label>
          <Input type="email" {...register("email", { required: true })} placeholder="john@example.com" data-testid="input-email" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{user ? "Password Baru (kosongkan jika tidak diubah)" : "Password *"}</Label>
        <Input type="password" {...register("password", { required: !user })} placeholder="••••••••" data-testid="input-password" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Role</Label>
        <Controller name="role" control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin_bpp">Admin BAPPEDA</SelectItem>
              <SelectItem value="admin_rida">Admin RIDA</SelectItem>
            </SelectContent>
          </Select>
        )} />
      </div>
      <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
        <Controller name="isActive" control={control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        <Label>Aktifkan akun pengguna ini</Label>
      </div>
      <Button type="submit" disabled={mutation.isPending} data-testid="button-save-user">
        {mutation.isPending ? "Menyimpan..." : "Simpan User"}
      </Button>
    </form>
  );
}

function UserTable({ users, onEdit }: { users: UserData[]; onEdit: (u: UserData) => void }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UserCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Tidak ada pengguna di kategori ini</p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Username / Email</TableHead>
          <TableHead className="w-32">Role</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="w-32">Dibuat</TableHead>
          <TableHead className="w-16 text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(u => (
          <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
            <TableCell className="font-medium">{u.fullName}</TableCell>
            <TableCell>
              <div className="text-sm">{u.username}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </TableCell>
            <TableCell>
              <Badge variant={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role] || u.role}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={u.isActive ? "default" : "secondary"}>
                {u.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(u.createdAt), "d MMM yyyy", { locale: id })}
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => onEdit(u)} data-testid={`button-edit-user-${u.id}`}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | undefined>();
  const [defaultRole, setDefaultRole] = useState<string>("admin_bpp");
  const { data: users = [], isLoading } = useQuery<UserData[]>({ queryKey: ["/api/admin/users"] });

  const openCreate = (role: string) => {
    setEditUser(undefined);
    setDefaultRole(role);
    setOpen(true);
  };

  const superAdmins = users.filter(u => u.role === "super_admin");
  const adminRida = users.filter(u => u.role === "admin_rida");
  const adminBpp = users.filter(u => u.role === "admin_bpp");
  const others = users.filter(u => !["super_admin", "admin_rida", "admin_bpp"].includes(u.role));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Manajemen User</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} pengguna terdaftar</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => openCreate("admin_bpp")} data-testid="button-add-user">
          <Plus className="w-4 h-4" /> Tambah User
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditUser(undefined); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "Tambah User"}</DialogTitle>
            <DialogDescription>Kelola data pengguna admin portal BAPPERIDA.</DialogDescription>
          </DialogHeader>
          <UserForm
            user={editUser}
            defaultRole={defaultRole}
            onDone={() => { setOpen(false); setEditUser(undefined); }}
          />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Card className="p-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full mb-2" />)}
        </Card>
      ) : (
        <Tabs defaultValue="admin_bpp">
          <TabsList className="mb-4">
            <TabsTrigger value="super_admin" className="gap-1.5" data-testid="tab-super-admin">
              <ShieldCheck className="w-3.5 h-3.5" />
              Super Admin
              <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{superAdmins.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="admin_rida" className="gap-1.5" data-testid="tab-admin-rida">
              <UserCog className="w-3.5 h-3.5" />
              Admin RIDA
              <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{adminRida.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="admin_bpp" className="gap-1.5" data-testid="tab-admin-bpp">
              <UserCog className="w-3.5 h-3.5" />
              Admin BAPPEDA
              <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{adminBpp.length}</Badge>
            </TabsTrigger>
            {others.length > 0 && (
              <TabsTrigger value="other" className="gap-1.5" data-testid="tab-other">
                <UserCircle2 className="w-3.5 h-3.5" />
                Lainnya
                <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">{others.length}</Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="super_admin">
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pengguna dengan akses penuh ke semua modul</p>
                <Button size="sm" variant="outline" onClick={() => openCreate("super_admin")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Super Admin
                </Button>
              </div>
              <UserTable users={superAdmins} onEdit={u => { setEditUser(u); setOpen(true); }} />
            </Card>
          </TabsContent>

          <TabsContent value="admin_rida">
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pengguna dengan akses modul RIDA (izin penelitian, survei, laporan)</p>
                <Button size="sm" variant="outline" onClick={() => openCreate("admin_rida")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Admin RIDA
                </Button>
              </div>
              <UserTable users={adminRida} onEdit={u => { setEditUser(u); setOpen(true); }} />
            </Card>
          </TabsContent>

          <TabsContent value="admin_bpp">
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pengguna dengan akses modul BAPPEDA (berita, banner, dokumen)</p>
                <Button size="sm" variant="outline" onClick={() => openCreate("admin_bpp")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Admin BAPPEDA
                </Button>
              </div>
              <UserTable users={adminBpp} onEdit={u => { setEditUser(u); setOpen(true); }} />
            </Card>
          </TabsContent>

          {others.length > 0 && (
            <TabsContent value="other">
              <Card>
                <UserTable users={others} onEdit={u => { setEditUser(u); setOpen(true); }} />
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
