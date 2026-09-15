import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPublicFrontendUrl } from './publicUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatCurrency = (val) => {
  const n = Number(val) || 0;
  return n.toFixed(2);
};

function buildInlineLogoAttachment() {
  try {
    const logoPath = path.resolve(__dirname, '../../frontend/public/logo.png');
    if (fs.existsSync(logoPath)) {
      return [{ filename: 'logo.png', path: logoPath, cid: 'companyLogo' }];
    }
  } catch { }
  return [];
}

function baseWrapper(title, innerHtml, useCidLogo) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const logo = process.env.COMPANY_LOGO_URL;
  const support = process.env.COMPANY_SUPPORT_EMAIL || 'support@pharmaplus.local';
  
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{background:#f5f7fa;font-family:Segoe UI,Arial,sans-serif;margin:0;padding:0;}
    .container{max-width:640px;margin:0 auto;padding:24px;}
    .card{background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 6px rgba(0,0,0,0.08);}
    h1{font-size:20px;margin:0 0 16px;font-weight:600;color:#1f2937;}
    p{line-height:1.5;font-size:14px;color:#374151;margin:0 0 16px;}
    .muted{color:#6b7280;font-size:12px;margin-top:24px;}
    .logo-wrap{text-align:center;margin-bottom:24px;}
    .cta{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;}
    .data-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;}
    .data-table th,.data-table td{padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;}
    .badge{display:inline-block;padding:4px 8px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:500;}
    @media (prefers-color-scheme: dark){body{background:#1f2937;} .card{background:#111827; box-shadow:0 2px 6px rgba(0,0,0,0.5);} h1{color:#f3f4f6;} p{color:#d1d5db;} .muted{color:#9ca3af;} .data-table th,.data-table td{border-bottom:1px solid #374151;} }
  </style></head><body>
  <div class="container">
    <div class="logo-wrap">${logo ? `<img src="${logo}" alt="${company} Logo" style="max-width:140px;max-height:60px;display:block;margin:0 auto;" />` : (useCidLogo ? `<img src="cid:companyLogo" alt="${company} Logo" style="max-width:140px;max-height:60px;display:block;margin:0 auto;" />` : `<div style=\"font-size:22px;font-weight:700;color:#2563eb;\">${company}</div>`)}</div>
    <div class="card">${innerHtml}
      <p class="muted">This is an automated message from ${company}. For assistance contact <a href="mailto:${support}">${support}</a>.</p>
    </div>
  </div>
  </body></html>`;
}

export function doctorApprovalTemplate(applicant, credentials, tenant = null) {
  const company = tenant ? tenant.name : (process.env.COMPANY_NAME || 'PharmaPlus HMS');
  const spec = applicant.specialization || 'N/A';
  const dept = applicant.department || 'N/A';
  const exp = applicant.yearsExperience || 0;
  const edu = applicant.education || 'N/A';
  
  const rows = [
    ['Email', applicant.email],
    ['Specialization', spec],
    ['Department', dept],
    ['Experience (years)', exp],
    ['Qualifications', edu]
  ].map(r => `<tr><th style="width:160px;">${r[0]}</th><td>${r[1]}</td></tr>`).join('');
  
  const useCid = !process.env.COMPANY_LOGO_URL;
  const publicBase = buildPublicFrontendUrl('');
  const setupUrl = credentials.setupUrl || (tenant ? `${publicBase}/portal/${tenant.slug}/login` : `${publicBase}/login`);
  
  const html = baseWrapper(`${company} Doctor Appointment Approved`, `
    <h1>Approval Confirmed - Doctor Onboarding</h1>
    <p>Dear Dr. ${applicant.name},</p>
    <p>We are pleased to inform you that your appointment as a <strong>Doctor</strong> with <strong>${company}</strong> has been <span class="badge">APPROVED</span>. Your HMS account has been created.</p>
    <table class="data-table">${rows}</table>
    <p>Please click the button below to securely set up your password and access the Doctor Panel.</p>
    <p style="text-align:center;margin:24px 0;"><a class="cta" href="${setupUrl}">Set Password</a></p>
    <p>This secure setup link will expire in 24 hours.</p>
    <p>If you did not initiate this application, please contact our support team immediately.</p>
    <p>Welcome to ${company}. We look forward to your valued contribution to patient care.</p>
    <p>Regards,<br/>Administration Team<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function doctorApplicationReceivedTemplate(applicant) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const spec = applicant.specialization || 'N/A';
  const dept = applicant.department || 'N/A';
  const exp = applicant.yearsExperience || 0;
  const edu = applicant.education || 'N/A';
  
  const rows = [
    ['Name', applicant.name],
    ['Email', applicant.email],
    ['Specialization', spec],
    ['Department', dept],
    ['Experience (years)', exp],
    ['Qualifications', edu]
  ].map(r => `<tr><th style="width:160px;">${r[0]}</th><td>${r[1]}</td></tr>`).join('');
  
  const useCid = !process.env.COMPANY_LOGO_URL;
  const html = baseWrapper(`${company} Doctor Application Received`, `
    <h1>Application Received</h1>
    <p>Dear ${applicant.name}, thank you for your interest in joining <strong>${company}</strong>.</p>
    <p>Our administrative team will review your details. You will receive an approval email with login credentials if your application is accepted.</p>
    <table class="data-table">${rows}</table>
    <p>You may reply to this email with any additional supporting documents (CV, certifications) to expedite processing.</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function appointmentCancellationTemplate({ appointment, doctor, tenant = null }) {
  const company = tenant ? tenant.name : (process.env.COMPANY_NAME || 'PharmaPlus HMS');
  const useCid = !process.env.COMPANY_LOGO_URL;
  const patientName = appointment.patientName || 'Patient';
  const whenStr = new Date(appointment.slotStart).toLocaleString();
  const docName = doctor?.name ? `Dr. ${doctor.name}` : 'Doctor';
  const reasonLine = appointment.status === 'cancelled' && (appointment.notes || appointment.cancellationReason) ? `<p><strong>Reason:</strong> ${appointment.notes || appointment.cancellationReason}</p>` : '';
  
  const html = baseWrapper(`${company} Appointment Cancelled`, `
    <h1>Appointment Cancelled</h1>
    <p>Dear ${patientName},</p>
    <p>Your appointment scheduled on <strong>${whenStr}</strong> with <strong>${docName}</strong> at <strong>${company}</strong> has been <span class="badge" style="background:#dc2626;color:#fff">CANCELLED</span>.</p>
    ${reasonLine}
    <table class="data-table">
      <tr><th style="width:160px;">Hospital</th><td>${company}</td></tr>
      <tr><th>Doctor</th><td>${docName}</td></tr>
      <tr><th>Date & Time</th><td>${whenStr}</td></tr>
      <tr><th>Token Number</th><td>#${appointment.tokenNumber}</td></tr>
      <tr><th>Status</th><td>Cancelled</td></tr>
    </table>
    <p>If you wish to reschedule, please book a new slot via the public portal or contact our support team.</p>
    <p>Regards,<br/>${company} Appointments Desk</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function passwordResetTemplate(user, resetUrl) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const useCid = !process.env.COMPANY_LOGO_URL;
  
  const html = baseWrapper(`${company} Password Reset Request`, `
    <h1>Password Reset Requested</h1>
    <p>Hi ${user.name || 'User'},</p>
    <p>We received a request to reset the password for your account (<strong>${user.email}</strong>).</p>
    <p>If you made this request, click the button below to set a new password. This link will expire in 10 minutes.</p>
    <p style="text-align:center;margin:24px 0;"><a class="cta" href="${resetUrl}">Reset Password</a></p>
    <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p>For security reasons, this link can be used only once.</p>
    <p>Regards,<br/>Security Team<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function queryReceivedTemplate(query) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const useCid = !process.env.COMPANY_LOGO_URL;
  const etaDays = 7;
  const createdStr = new Date(query.createdAt || Date.now()).toLocaleString();
  
  const html = baseWrapper(`${company} Query Received`, `
    <h1>We've Received Your Query</h1>
    <p>Dear ${query.name || 'Guest'},</p>
    <p>Thank you for contacting <strong>${company}</strong>. Your query has been successfully logged in our helpdesk system.</p>
    <table class="data-table">
      <tr><th style="width:160px;">Reference ID</th><td>${query._id}</td></tr>
      <tr><th>Submitted At</th><td>${createdStr}</td></tr>
      <tr><th>Status</th><td><span class="badge">New</span></td></tr>
    </table>
    <p>Our support team aims to provide an update or resolution within <strong>${etaDays} working days</strong>. You will receive an email whenever the status changes.</p>
    <p>If you wish to add more information, you can reply to this email.</p>
    <p>Regards,<br/>Support Team<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function queryStatusUpdateTemplate(query, previousStatus) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const useCid = !process.env.COMPANY_LOGO_URL;
  const statusLabel = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  
  const html = baseWrapper(`${company} Query Status Updated`, `
    <h1>Query Status Update</h1>
    <p>Dear ${query.name || 'User'},</p>
    <p>Your query (<strong>ID: ${query._id}</strong>) status changed from <strong>${statusLabel(previousStatus)}</strong> to <strong>${statusLabel(query.status)}</strong>.</p>
    <table class="data-table">
      <tr><th style="width:160px;">Reference ID</th><td>${query._id}</td></tr>
      <tr><th>Current Status</th><td>${statusLabel(query.status)}</td></tr>
      <tr><th>Message Snippet</th><td>${(query.message || '').slice(0, 140)}${(query.message || '').length > 140 ? '...' : ''}</td></tr>
      <tr><th>Updated At</th><td>${new Date(query.updatedAt || Date.now()).toLocaleString()}</td></tr>
    </table>
    <p>${query.status === 'solved' ? 'We believe your query has been resolved. If not, just reply to this email and let us know.' : query.status === 'closed' ? 'This query has been closed. Feel free to open a new query if you need further assistance.' : 'We are still working on your query and will keep you updated.'}</p>
    <p>Regards,<br/>Support Team<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function bedAllocationTemplate({ patient, ward, bed, dailyCost, authority }) {
  const company = process.env.COMPANY_NAME || 'PharmaPlus HMS';
  const useCid = !process.env.COMPANY_LOGO_URL;
  
  const html = baseWrapper(`${company} Bed Allocation Confirmed`, `
    <h1>Inpatient Bed Allocation</h1>
    <p>Dear ${patient.firstName || patient.name || 'Patient'},</p>
    <p>Your admission has been processed. Below are your bed details:</p>
    <table class="data-table">
      <tr><th style="width:160px;">Ward</th><td>${ward.name} (${ward.type})</td></tr>
      <tr><th>Bed Number</th><td>${bed.bedNumber}</td></tr>
      <tr><th>Daily Room Charge</th><td>${formatCurrency(dailyCost)}</td></tr>
      <tr><th>Allocating Authority</th><td>${authority || 'N/A'}</td></tr>
      <tr><th>Allocated At</th><td>${new Date().toLocaleString()}</td></tr>
    </table>
    <p>An initial invoice has been generated for the first day room charge. Further charges will be added to your final bill upon discharge.</p>
    <p>Regards,<br/>Admissions Desk<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}

export function staffWelcomeTemplate(staff, roleName, tenant, setupUrl) {
  const company = tenant ? tenant.name : (process.env.COMPANY_NAME || 'PharmaPlus HMS');
  const useCid = !process.env.COMPANY_LOGO_URL;
  
  const formattedRole = roleName.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  const html = baseWrapper(`${company} Account Created`, `
    <h1>Welcome to ${company}</h1>
    <p>Dear ${staff.name},</p>
    <p>An account has been provisioned for you as a <strong>${formattedRole}</strong>.</p>
    <p>Please click the button below to securely set up your password and access the hospital portal.</p>
    <p style="text-align:center;margin:24px 0;"><a class="cta" href="${setupUrl}">Set Password</a></p>
    <p>This secure setup link will expire in 24 hours.</p>
    <p>If you have any questions, please contact your Hospital Administrator.</p>
    <p>Regards,<br/>Administration Team<br/>${company}</p>
  `, useCid);
  
  const attachments = useCid ? buildInlineLogoAttachment() : [];
  return { html, attachments };
}
