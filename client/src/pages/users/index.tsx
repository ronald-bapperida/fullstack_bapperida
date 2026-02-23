import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const ROLE_LABELS: Record<string, string> = { super_admin: "Super Admin", admin_bpp: "Admin BAPPEDA", admin_rida: "Admin RIDA" };
const ROLE_COLORS: Record<string, "default" | "secondary" | "outline"> = { super_admin: "default", admin_bpp: "secondary", admin_rida: "outline" };

interface UserData { id: string; username: string; email: string; fullName: string; role: string; isActive: boolean; createdAt: string; }

function UserForm({ user, onDone }: { user?: UserData; onDone: () => void }) {
  const { toast } = useToast();
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      fullName: user?.fullName || "",
      role: user?.role || "admin_bpp",
      isActive: user?.isActive ?? true,
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = user
        ? await apiRequest("PATCH", `/api/admin/users/${user.id}`, data)
        : await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: user ? "User diupdate" : "User dibuat" }); onDone(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label>Nama Lengkap</Label>
        <Input {...register("fullName", { required: true })} placeholder="John Doe" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Username</Label>
          <Input {...register("username", { required: true })} placeholder="johndoe" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Email</Label>
          <Input type="email" {...register("email", { required: true })} placeholder="john@example.com" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{user ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</Label>
        <Input type="password" {...register("password", { required: !user })} placeholder="••••••••" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Role</Label>
        <Controller name="role" control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin_bpp">Admin BAPPEDA</SelectItem>
              <SelectItem value="admin_rida">Admin RIDA</SelectItem>
            </SelectContent>
          </Select>
        )} />
      </div>
      <div className="flex items-center gap-3">
        <Controller name="isActive" control={control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        <Label>Aktif</Label>
      </div>
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}

export default function UsersPage() {
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | undefined>();
  const { data: users = [], isLoading } = useQuery<UserData[]>({ queryKey: ["/api/admin/users"] });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Manajemen User</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} pengguna terdaftar</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditUser(undefined); setOpen(true); }} data-testid="button-add-user">
          <Plus className="w-4 h-4" /> Tambah User
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditUser(undefined); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
          <UserForm user={editUser} onDone={() => { setOpen(false); setEditUser(undefined); }} />
        </DialogContent>
      </Dialog>

      <Card>
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
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : users.map(u => (
              <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                <TableCell className="font-medium">{u.fullName}</TableCell>
                <TableCell>
                  <div className="text-sm">{u.username}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell><Badge variant={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge></TableCell>
                <TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(u.createdAt), "d MMM yyyy", { locale: id })}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => { setEditUser(u); setOpen(true); }} data-testid={`button-edit-user-${u.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
