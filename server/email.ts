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

function wrapHtml(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1e3a5f; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 18px; }
    .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.8; }
    .body { padding: 24px 32px; color: #333; font-size: 14px; line-height: 1.6; }
    .body h2 { color: #1e3a5f; font-size: 16px; margin: 0 0 12px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .info-table td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .info-table td:first-child { color: #666; width: 40%; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; }
    .badge-pending { background: #fef9c3; color: #713f12; }
    .badge-approved { background: #dcfce7; color: #166534; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-review { background: #dbeafe; color: #1e40af; }
    .token-box { background: #f0f4ff; border: 1px solid #c7d7ff; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #1e3a5f; text-align: center; font-family: monospace; }
    .footer { background: #f9fafb; padding: 16px 32px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #eee; }
    .btn { display: inline-block; padding: 10px 20px; background: #1e3a5f; color: #fff; border-radius: 5px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 12px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BAPPERIDA Kalimantan Tengah</h1>
      <p>Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah</p>
    </div>
    <div class="body">
      <h2>${title}</h2>
      ${body}
    </div>
    <div class="footer">
      Email ini dikirim secara otomatis. Jangan membalas email ini.<br/>
      &copy; ${new Date().getFullYear()} BAPPERIDA Kalimantan Tengah
    </div>
  </div>
</body>
</html>`;
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
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terima kasih telah mengajukan permohonan Izin Penelitian. Permohonan Anda telah kami terima dan sedang dalam proses peninjauan.</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Nama Pemohon</td><td>${opts.fullName}</td></tr>
      <tr><td>Asal Institusi</td><td>${opts.institution}</td></tr>
      <tr><td>Judul Penelitian</td><td>${opts.researchTitle}</td></tr>
      <tr><td>Status Awal</td><td><span class="badge badge-pending">Diajukan</span></td></tr>
    </table>
    <p>Anda dapat memantau status permohonan melalui aplikasi BAPPERIDA dengan menggunakan nomor permohonan di atas.</p>
    <p>Kami akan mengirimkan notifikasi email ketika status permohonan Anda berubah.</p>
    <hr class="divider"/>
    <p style="color:#888;font-size:12px;">Jika Anda memiliki pertanyaan, silakan hubungi kantor BAPPERIDA Kalimantan Tengah.</p>
  `;
  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Permohonan Izin Penelitian Diterima - ${opts.requestNumber}`,
    html: wrapHtml("Permohonan Izin Penelitian Diterima", body),
  });
}

// ─── Izin Penelitian: Status berubah (generic) ────────────────────────────────
export async function sendPermitStatusEmail(opts: {
  to: string;
  fullName: string;
  requestNumber: string;
  status: string;
  note?: string;
}) {
  const statusLabel: Record<string, string> = {
    in_review: "Sedang Ditinjau",
    revision_requested: "Perlu Revisi",
    approved: "Disetujui",
    generated_letter: "Surat Dibuat",
    sent: "Terkirim",
    rejected: "Ditolak",
  };
  const statusClass: Record<string, string> = {
    approved: "badge-approved",
    rejected: "badge-rejected",
    in_review: "badge-review",
    generated_letter: "badge-approved",
    sent: "badge-approved",
  };
  const label = statusLabel[opts.status] || opts.status;
  const cls = statusClass[opts.status] || "badge-pending";

  const body = `
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terdapat pembaruan status untuk permohonan Izin Penelitian Anda:</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Status Terbaru</td><td><span class="badge ${cls}">${label}</span></td></tr>
      ${opts.note ? `<tr><td>Catatan</td><td>${opts.note}</td></tr>` : ""}
    </table>
    ${opts.status === "revision_requested" ? `<p><strong>Tindakan diperlukan:</strong> Silakan perbaiki dokumen Anda sesuai catatan di atas dan ajukan kembali.</p>` : ""}
    ${opts.status === "rejected" ? `<p>Mohon maaf, permohonan Anda tidak dapat disetujui. Silakan hubungi kantor BAPPERIDA untuk informasi lebih lanjut.</p>` : ""}
    <hr class="divider"/>
    <p style="color:#888;font-size:12px;">Jika Anda memiliki pertanyaan, silakan hubungi kantor BAPPERIDA Kalimantan Tengah.</p>
  `;
  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Update Status Izin Penelitian ${opts.requestNumber} — ${label}`,
    html: wrapHtml(`Status Permohonan: ${label}`, body),
  });
}

// ─── Izin Penelitian: Kirim surat (approved) ──────────────────────────────────
export async function sendPermitLetterEmail(opts: {
  to: string;
  fullName: string;
  requestNumber: string;
  filePath: string;
  fileName: string;
}) {
  const body = `
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Dengan hormat, bersama email ini kami sampaikan Surat Izin Penelitian Anda telah <strong>disetujui</strong>. Terlampir file surat izin penelitian resmi dari BAPPERIDA Kalimantan Tengah.</p>
    <table class="info-table">
      <tr><td>Nomor Permohonan</td><td><strong>${opts.requestNumber}</strong></td></tr>
      <tr><td>Nama Pemohon</td><td>${opts.fullName}</td></tr>
      <tr><td>Status</td><td><span class="badge badge-approved">Disetujui</span></td></tr>
    </table>
    <p>Harap simpan surat izin ini dengan baik sebagai bukti persetujuan penelitian Anda di wilayah Kalimantan Tengah.</p>
    <hr class="divider"/>
    <p style="color:#888;font-size:12px;">Jika Anda memiliki pertanyaan, silakan hubungi kantor BAPPERIDA Kalimantan Tengah.</p>
  `;
  return sendMail({
    to: opts.to,
    subject: `[BAPPERIDA] Surat Izin Penelitian - ${opts.requestNumber}`,
    html: wrapHtml("Surat Izin Penelitian Disetujui", body),
    attachments: [
      {
        filename: opts.fileName,
        content: fs.readFileSync(opts.filePath),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  });
}

// ─── PPID Permohonan Informasi: Konfirmasi + Token ────────────────────────────
export async function sendPpidInfoRequestConfirmation(opts: {
  to: string;
  fullName: string;
  token: string;
  informationDetail: string;
}) {
  const body = `
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terima kasih telah mengajukan <strong>Permohonan Informasi</strong> kepada PPID BAPPERIDA Kalimantan Tengah. Permohonan Anda telah kami terima.</p>
    <p>Berikut adalah <strong>Token Pelacakan</strong> permohonan Anda. Simpan token ini untuk memeriksa status permohonan:</p>
    <div class="token-box">${opts.token}</div>
    <table class="info-table">
      <tr><td>Nama</td><td>${opts.fullName}</td></tr>
      <tr><td>Informasi yang Diminta</td><td>${opts.informationDetail}</td></tr>
      <tr><td>Status</td><td><span class="badge badge-pending">Menunggu</span></td></tr>
    </table>
    <p>Gunakan token di atas untuk memeriksa status permohonan Anda melalui aplikasi BAPPERIDA.</p>
    <hr class="divider"/>
    <p style="color:#888;font-size:12px;">Kami akan merespons permohonan Anda dalam waktu 10 hari kerja sesuai ketentuan yang berlaku.</p>
  `;
  return sendMail({
    to: opts.to,
    subject: `[PPID BAPPERIDA] Konfirmasi Permohonan Informasi - Token: ${opts.token}`,
    html: wrapHtml("Permohonan Informasi Diterima", body),
  });
}

// ─── PPID Permohonan Informasi: Balasan Admin (dengan/tanpa file) ─────────────
export async function sendPpidInfoRequestReply(opts: {
  to: string;
  fullName: string;
  token: string;
  status: string;
  reviewNote?: string;
  attachmentPath?: string;
  attachmentName?: string;
}) {
  const statusLabel: Record<string, string> = {
    resolved: "Selesai / Informasi Tersedia",
    rejected: "Ditolak",
    in_review: "Sedang Diproses",
  };
  const statusClass: Record<string, string> = {
    resolved: "badge-approved",
    rejected: "badge-rejected",
    in_review: "badge-review",
  };
  const label = statusLabel[opts.status] || opts.status;
  const cls = statusClass[opts.status] || "badge-pending";

  const body = `
    <p>Yth. <strong>${opts.fullName}</strong>,</p>
    <p>Terdapat pembaruan untuk <strong>Permohonan Informasi</strong> Anda:</p>
    <div class="token-box" style="font-size:14px;">${opts.token}</div>
    <table class="info-table">
      <tr><td>Status</td><td><span class="badge ${cls}">${label}</span></td></tr>
      ${opts.reviewNote ? `<tr><td>Tanggapan Admin</td><td>${opts.reviewNote}</td></tr>` : ""}
    </table>
    ${opts.attachmentPath ? `<p>Terlampir file informasi yang Anda minta.</p>` : ""}
    ${opts.status === "rejected" ? `<p>Jika Anda tidak setuju dengan keputusan ini, Anda dapat mengajukan <strong>Keberatan</strong> melalui aplikasi BAPPERIDA dengan mencantumkan nomor token Anda.</p>` : ""}
    <hr class="divider"/>
    <p style="color:#888;font-size:12px;">Jika Anda memiliki pertanyaan, silakan hubungi kantor BAPPERIDA Kalimantan Tengah.</p>
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
    subject: `[PPID BAPPERIDA] Tanggapan Permohonan Informasi — ${label}`,
    html: wrapHtml(`Status Permohonan: ${label}`, body),
    attachments,
  });
}
