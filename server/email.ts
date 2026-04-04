import nodemailer from "nodemailer";
import fs from "fs";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "albertkristadeo02@gmail.com",
    pass: process.env.SMTP_PASS || "biqb weum ixka fbtj",
  },
});

const FROM = `"BAPPERIDA Kalteng" <${process.env.SMTP_USER || "albertkristadeo02@gmail.com"}>`;

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  path?: string;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  return transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}

// ─── Template helpers ──────────────────────────────────────────────────────────

const GMAP_URL = "https://maps.google.com/?q=Jl.+Diponegoro+No.60+Panarung+Palangka+Raya+Kalimantan+Tengah";
const BAPPERIDA_ADDRESS = "Jl. Diponegoro No.60, Panarung, Kec. Pahandut, Kota Palangka Raya, Kalimantan Tengah 73112";

function wrapHtml(title: string, body: string, accentColor = "#1e3a5f") {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f2f5; color: #333; }
    .wrap { max-width: 620px; margin: 28px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, ${accentColor} 0%, #2a5298 100%); color: #fff; padding: 28px 32px 20px; }
    .header-top { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .logo-badge { width: 48px; height: 48px; background: rgba(255,255,255,0.18); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
    .org-name { font-size: 17px; font-weight: 700; letter-spacing: 0.3px; }
    .org-sub { font-size: 11px; opacity: 0.80; margin-top: 2px; }
    .header h2 { font-size: 14px; font-weight: 400; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.25); padding-top: 10px; margin-top: 10px; }
    .body { padding: 28px 32px; font-size: 14px; line-height: 1.7; color: #374151; }
    .body h3 { color: ${accentColor}; font-size: 16px; margin-bottom: 14px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
    .info-table td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .info-table tr:last-child td { border-bottom: none; }
    .info-table td:first-child { color: #6b7280; font-size: 12px; font-weight: 600; width: 38%; background: #f9fafb; text-transform: uppercase; letter-spacing: 0.3px; }
    .status-pill { display: inline-block; padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; }
    .token-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 14px 20px; margin: 18px 0; font-size: 22px; font-weight: 800; letter-spacing: 3px; color: #1e40af; text-align: center; font-family: 'Courier New', monospace; }
    .privacy-box { background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 20px 0; font-size: 12.5px; color: #78350f; line-height: 1.6; }
    .privacy-box strong { color: #92400e; }
    .address-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin: 12px 0; font-size: 12.5px; color: #166534; }
    .address-box a { color: #16a34a; font-weight: 600; text-decoration: none; }
    .address-box a:hover { text-decoration: underline; }
    .footer { background: #f9fafb; padding: 18px 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer a { color: #6b7280; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
    .note-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-style: italic; color: #64748b; font-size: 13px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="header-top">
        <div class="logo-badge">🏛️</div>
        <div>
          <div class="org-name">BAPPERIDA Kalimantan Tengah</div>
          <div class="org-sub">Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah</div>
        </div>
      </div>
      <h2>${title}</h2>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      Email ini dikirim otomatis oleh sistem BAPPERIDA Kalimantan Tengah &mdash; jangan membalas email ini.<br/>
      &copy; ${new Date().getFullYear()} BAPPERIDA Kalimantan Tengah &bull; <a href="${GMAP_URL}" target="_blank">Lihat Lokasi</a>
    </div>
  </div>
</body>
</html>`;
}

function privacyNotice() {
  return `
    <div class="privacy-box">
      <strong>🔒 Perhatian Kerahasiaan Data</strong><br/>
      Mohon untuk tidak memberikan data atau informasi pribadi Anda kepada pihak lain.
      BAPPERIDA tidak pernah meminta data sensitif melalui email atau telepon di luar prosedur resmi.
    </div>`;
}

function addressBlock() {
  return `
    <div class="address-box">
      📍 <strong>Kontak &amp; Alamat BAPPERIDA:</strong><br/>
      ${BAPPERIDA_ADDRESS}<br/>
      <a href="${GMAP_URL}" target="_blank">📌 Buka di Google Maps</a>
    </div>`;
}

// ─── Izin Penelitian: Konfirmasi pengajuan ─────────────────────────────────────
export async function sendPermitSubmittedEmail(opts: {
  to: string;
  fullName: string;
  requestNumber: string;
  institution: string;
  researchTitle: string;
}) {
  const body = `
    <h3>Permohonan Izin Penelitian Diterima</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terima kasih telah mengajukan permohonan Izin Penelitian kepada BAPPERIDA Kalimantan Tengah. Permohonan Anda telah kami terima dan sedang dalam proses peninjauan.</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Nama Pemohon</td><td>${opts.fullName}</td></tr>
      <tr><td>Asal Institusi</td><td>${opts.institution}</td></tr>
      <tr><td>Judul Penelitian</td><td>${opts.researchTitle}</td></tr>
      <tr><td>Status</td><td><span class="status-pill" style="background:#fef9c3;color:#713f12;">📋 Diajukan</span></td></tr>
    </table>
    <p>Anda dapat memantau status permohonan melalui aplikasi BAPPERIDA menggunakan <strong>Nomor Permohonan</strong> di atas. Kami akan mengirimkan notifikasi email ketika status permohonan Anda berubah.</p>
    ${privacyNotice()}
    ${addressBlock()}
  `;
  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Permohonan Izin Penelitian Diterima — ${opts.requestNumber}`,
    html: wrapHtml("Konfirmasi Pengajuan Izin Penelitian", body),
  });
}

// ─── Izin Penelitian: Status berubah ─────────────────────────────────────────
export async function sendPermitStatusEmail(opts: {
  to: string;
  fullName: string;
  requestNumber: string;
  status: string;
  note?: string;
  pdfAttachment?: Buffer;
  pdfFileName?: string;
}) {
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string; message: string }> = {
    in_review: {
      label: "Sedang Dalam Review",
      color: "#1e40af", bg: "#dbeafe", emoji: "🔍",
      message: "Permohonan Izin Penelitian Anda sedang dalam proses peninjauan oleh tim BAPPERIDA. Kami akan segera memproses permohonan Anda.",
    },
    revision_requested: {
      label: "Perlu Revisi",
      color: "#92400e", bg: "#fef3c7", emoji: "✏️",
      message: "Permohonan Anda memerlukan perbaikan. Mohon perbaiki dokumen sesuai catatan di bawah dan ajukan kembali.",
    },
    approved: {
      label: "Disetujui",
      color: "#065f46", bg: "#d1fae5", emoji: "✅",
      message: "Selamat! Permohonan Izin Penelitian Anda telah disetujui oleh BAPPERIDA Kalimantan Tengah.",
    },
    generated_letter: {
      label: "Surat Izin Dibuat",
      color: "#065f46", bg: "#d1fae5", emoji: "📄",
      message: "Surat Izin Penelitian Anda telah diterbitkan. Terlampir file PDF Surat Izin Penelitian resmi dari BAPPERIDA Kalimantan Tengah.",
    },
    sent: {
      label: "Surat Terkirim",
      color: "#1e3a8a", bg: "#dbeafe", emoji: "📬",
      message: "Surat Izin Penelitian Anda telah dikirimkan. Harap simpan surat izin ini sebagai bukti persetujuan.",
    },
    rejected: {
      label: "Ditolak",
      color: "#991b1b", bg: "#fee2e2", emoji: "❌",
      message: "Mohon maaf, permohonan Izin Penelitian Anda tidak dapat kami setujui saat ini. Silakan hubungi kantor BAPPERIDA untuk informasi lebih lanjut.",
    },
  };

  const cfg = STATUS_CONFIG[opts.status] || {
    label: opts.status, color: "#374151", bg: "#f3f4f6", emoji: "ℹ️",
    message: "Status permohonan Anda telah diperbarui.",
  };

  const accentColor = opts.status === "rejected" ? "#991b1b"
    : opts.status === "approved" || opts.status === "generated_letter" || opts.status === "sent" ? "#065f46"
    : "#1e3a5f";

  const body = `
    <h3>${cfg.emoji} Status Permohonan: ${cfg.label}</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>${cfg.message}</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Status Terbaru</td>
        <td><span class="status-pill" style="background:${cfg.bg};color:${cfg.color};">${cfg.emoji} ${cfg.label}</span></td>
      </tr>
      ${opts.note ? `<tr><td>Catatan</td><td><em>${opts.note}</em></td></tr>` : ""}
    </table>
    ${opts.status === "revision_requested" ? `
      <div class="note-box">Tindakan diperlukan: Perbaiki dokumen sesuai catatan di atas, lalu unggah kembali melalui aplikasi BAPPERIDA.</div>` : ""}
    ${privacyNotice()}
    ${addressBlock()}
  `;
  // ${opts.pdfAttachment ? `<p>📎 <strong>Surat Izin Penelitian (PDF)</strong> terlampir bersama email ini. Harap simpan sebagai bukti resmi.</p>` : ""}

  const attachments: MailAttachment[] = [];
  if (opts.pdfAttachment && opts.pdfFileName) {
    attachments.push({
      filename: opts.pdfFileName,
      content: opts.pdfAttachment,
      contentType: "application/pdf",
    });
  }

  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Status Izin Penelitian ${opts.requestNumber} — ${cfg.label}`,
    html: wrapHtml(`Status Permohonan: ${cfg.label}`, body, accentColor),
    // attachments,
  });
}

// ─── Izin Penelitian: Kirim surat via email (status → sent) ───────────────────
export async function sendPermitLetterEmail(opts: {
  to: string;
  fullName: string;
  requestNumber: string;
  filePath: string;
  fileName: string;
  pdfBuffer?: Buffer;
  pdfName?: string;
}) {
  const body = `
    <h3>📄 Surat Izin Penelitian Anda Telah Terbit</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Dengan hormat, bersama email ini kami sampaikan bahwa Surat Izin Penelitian Anda telah <strong>diterbitkan dan dikirimkan</strong> secara resmi oleh BAPPERIDA Kalimantan Tengah.</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Nama Pemohon</td><td>${opts.fullName}</td></tr>
      <tr><td>Status</td><td><span class="status-pill" style="background:#d1fae5;color:#065f46;">✅ Surat Terkirim</span></td></tr>
    </table>
    <p>📎 Terlampir file Surat Izin Penelitian resmi. Harap simpan surat ini dengan baik sebagai bukti persetujuan penelitian di wilayah Kalimantan Tengah.</p>
    ${privacyNotice()}
    ${addressBlock()}
  `;

  const attachments: MailAttachment[] = [];

  // Prioritas: PDF terlebih dahulu, fallback ke DOCX
  if (opts.pdfBuffer && opts.pdfName) {
    attachments.push({
      filename: opts.pdfName,
      content: opts.pdfBuffer,
      contentType: "application/pdf",
    });
  } else if (fs.existsSync(opts.filePath)) {
    attachments.push({
      filename: opts.fileName,
      content: fs.readFileSync(opts.filePath),
      contentType: opts.fileName.endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Surat Izin Penelitian Resmi — ${opts.requestNumber}`,
    html: wrapHtml("Surat Izin Penelitian Resmi", body, "#065f46"),
    attachments,
  });
}

// ─── PPID Permohonan Informasi: Konfirmasi + Request Code ─────────────────────
export async function sendPpidInfoRequestConfirmation(opts: {
  to: string;
  fullName: string;
  token: string;
  informationDetail: string;
}) {
  const body = `
    <h3>📋 Permohonan Informasi Diterima</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terima kasih telah mengajukan <strong>Permohonan Informasi</strong> kepada PPID BAPPERIDA Kalimantan Tengah. Permohonan Anda telah kami terima dan sedang diproses.</p>
    <p>Berikut adalah <strong>Kode Permohonan</strong> Anda. Simpan kode ini untuk melacak status atau mengajukan keberatan jika diperlukan:</p>
    <div class="token-box">${opts.token}</div>
    <table class="info-table">
      <tr><td>Nama</td><td>${opts.fullName}</td></tr>
      <tr><td>Informasi yang Diminta</td><td>${opts.informationDetail}</td></tr>
      <tr><td>Status</td><td><span class="status-pill" style="background:#fef9c3;color:#713f12;">⏳ Menunggu</span></td></tr>
    </table>
    <p>Gunakan <strong>Kode Permohonan</strong> di atas untuk memeriksa status permohonan atau mengajukan keberatan melalui aplikasi BAPPERIDA.</p>
    ${privacyNotice()}
    ${addressBlock()}
  `;
  return sendMail({
    to: opts.to,
    subject: `[PPID BAPPERIDA] Konfirmasi Permohonan Informasi — Kode: ${opts.token}`,
    html: wrapHtml("Konfirmasi Permohonan Informasi PPID", body),
  });
}

// ─── PPID Permohonan Informasi: Balasan Admin ─────────────────────────────────
export async function sendKeberatanConfirmation(opts: {
  to: string;
  fullName: string;
  objectionId: string;
  requestCode?: string;
}) {
  const body = `
    <h3>📨 Keberatan PPID Berhasil Dikirim</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Keberatan Anda terhadap permohonan informasi PPID BAPPERIDA Kalimantan Tengah telah berhasil diterima dan sedang dalam proses peninjauan.</p>
    <table class="info-table">
      <tr><td>ID Keberatan</td><td>${opts.objectionId}</td></tr>
      ${opts.requestCode ? `<tr><td>Kode Permohonan Asal</td><td>${opts.requestCode}</td></tr>` : ""}
      <tr><td>Status</td><td><span class="status-pill" style="background:#dbeafe;color:#1e40af;">🔍 Dalam Peninjauan</span></td></tr>
    </table>
    <div class="note-box">
      Tim PPID akan meninjau keberatan Anda dan memberikan tanggapan dalam waktu yang ditentukan sesuai peraturan perundang-undangan yang berlaku.
      Harap simpan email ini sebagai bukti pengajuan keberatan Anda.
    </div>
    ${privacyNotice()}
    ${addressBlock()}
  `;

  return sendMail({
    to: opts.to,
    subject: `[PPID BAPPERIDA] Keberatan Anda Telah Diterima`,
    html: wrapHtml("Konfirmasi Penerimaan Keberatan", body),
  });
}

// ─── OTP Reset Password ────────────────────────────────────────────────────────
export async function sendOtpResetEmail(opts: {
  to: string;
  fullName: string;
  otp: string;
}) {
  const body = `
    <h3>🔑 Kode OTP Reset Password</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Kami menerima permintaan reset password untuk akun Anda di BAPPERIDA Kalimantan Tengah. Gunakan kode OTP berikut untuk melanjutkan proses reset password:</p>
    <div class="token-box">${opts.otp}</div>
    <p>Kode OTP ini <strong>berlaku selama 10 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
    <div class="privacy-box">
      <strong>⚠️ Penting:</strong> Jika Anda tidak meminta reset password, abaikan email ini. Akun Anda tetap aman.
    </div>
    ${addressBlock()}
  `;
  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Kode OTP Reset Password Anda`,
    html: wrapHtml("Reset Password", body, "#7c3aed"),
  });
}

export async function sendPpidInfoRequestReply(opts: {
  to: string;
  fullName: string;
  token: string;
  status: string;
  reviewNote?: string;
  attachmentPath?: string;
  attachmentName?: string;
}) {
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string; message: string }> = {
    resolved: {
      label: "Selesai / Informasi Tersedia",
      color: "#065f46", bg: "#d1fae5", emoji: "✅",
      message: "Permohonan informasi Anda telah selesai diproses. Informasi yang diminta tersedia dan terlampir atau dapat diambil sesuai metode yang dipilih.",
    },
    rejected: {
      label: "Ditolak",
      color: "#991b1b", bg: "#fee2e2", emoji: "❌",
      message: "Mohon maaf, permohonan informasi Anda tidak dapat dipenuhi. Jika Anda tidak setuju, Anda dapat mengajukan Keberatan menggunakan Kode Permohonan Anda.",
    },
    in_review: {
      label: "Sedang Diproses",
      color: "#1e40af", bg: "#dbeafe", emoji: "🔍",
      message: "Permohonan informasi Anda sedang dalam proses peninjauan oleh tim PPID BAPPERIDA.",
    },
  };

  const cfg = STATUS_CONFIG[opts.status] || {
    label: opts.status, color: "#374151", bg: "#f3f4f6", emoji: "ℹ️",
    message: "Status permohonan informasi Anda telah diperbarui.",
  };

  const body = `
    <h3>${cfg.emoji} Tanggapan Permohonan Informasi PPID</h3>
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>${cfg.message}</p>
    <p><strong>Kode Permohonan Anda:</strong></p>
    <div class="token-box" style="font-size:16px;">${opts.token}</div>
    <table class="info-table">
      <tr><td>Status</td><td><span class="status-pill" style="background:${cfg.bg};color:${cfg.color};">${cfg.emoji} ${cfg.label}</span></td></tr>
      ${opts.reviewNote ? `<tr><td>Tanggapan</td><td>${opts.reviewNote}</td></tr>` : ""}
    </table>
    ${opts.attachmentPath ? `<p>📎 File informasi yang Anda minta terlampir bersama email ini.</p>` : ""}
    ${opts.status === "rejected" ? `
      <div class="note-box">Jika Anda tidak setuju dengan keputusan ini, Anda dapat mengajukan <strong>Keberatan</strong> melalui aplikasi BAPPERIDA dengan mencantumkan Kode Permohonan Anda.</div>` : ""}
    ${privacyNotice()}
    ${addressBlock()}
  `;

  const attachments: MailAttachment[] = [];
  if (opts.attachmentPath && opts.attachmentName && fs.existsSync(opts.attachmentPath)) {
    attachments.push({
      filename: opts.attachmentName,
      content: fs.readFileSync(opts.attachmentPath),
    });
  }

  return sendMail({
    to: opts.to,
    subject: `[PPID BAPPERIDA] Tanggapan Permohonan Informasi — ${cfg.label}`,
    html: wrapHtml(`Tanggapan Permohonan: ${cfg.label}`, body),
    attachments,
  });
}
