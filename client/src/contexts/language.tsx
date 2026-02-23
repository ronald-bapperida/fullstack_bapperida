import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "id" | "en";

const translations: Record<Lang, Record<string, string>> = {
  id: {
    dashboard: "Dashboard",
    news: "Berita",
    categories: "Kategori Berita",
    banners: "Banner",
    menus: "Menus",
    documents: "Dokumen PPID",
    docKinds: "Jenis Dokumen",
    docCategories: "Kategori Dokumen",
    docTypes: "Tipe File",
    permits: "Izin Penelitian",
    surveys: "Survei IKM",
    reports: "Laporan Akhir",
    suggestions: "Kotak Saran",
    templates: "Template Surat",
    users: "Manajemen User",
    bappeda: "BAPPEDA",
    rida: "RIDA",
    administration: "Administrasi",
    general: "Umum",
    logout: "Keluar",
    logoutConfirm: "Apakah Anda yakin ingin keluar dari sistem?",
    logoutTitle: "Konfirmasi Keluar",
    cancel: "Batal",
    confirm: "Ya, Keluar",
    portal: "Portal Admin BAPPERIDA Kalteng",
    save: "Simpan",
    edit: "Edit",
    delete: "Hapus",
    add: "Tambah",
    search: "Cari",
    name: "Nama",
    action: "Aksi",
    status: "Status",
    active: "Aktif",
    inactive: "Nonaktif",
    draft: "Draft",
    published: "Published",
    trash: "Trash",
    restore: "Pulihkan",
    previous: "Sebelumnya",
    next: "Berikutnya",
    page: "Halaman",
    of: "dari",
  },
  en: {
    dashboard: "Dashboard",
    news: "News",
    categories: "News Categories",
    banners: "Banners",
    menus: "Menus",
    documents: "PPID Documents",
    docKinds: "Document Kinds",
    docCategories: "Document Categories",
    docTypes: "File Types",
    permits: "Research Permits",
    surveys: "IKM Survey",
    reports: "Final Reports",
    suggestions: "Suggestions Box",
    templates: "Letter Templates",
    users: "User Management",
    bappeda: "BAPPEDA",
    rida: "RIDA",
    administration: "Administration",
    general: "General",
    logout: "Sign Out",
    logoutConfirm: "Are you sure you want to sign out?",
    logoutTitle: "Confirm Sign Out",
    cancel: "Cancel",
    confirm: "Yes, Sign Out",
    portal: "BAPPERIDA Kalteng Admin Portal",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    search: "Search",
    name: "Name",
    action: "Action",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    draft: "Draft",
    published: "Published",
    trash: "Trash",
    restore: "Restore",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
  },
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "id");

  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };

  const t = (key: string) => translations[lang][key] || key;

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
}
