/**
 * Prescription Template Configurations & HTML Print Generator
 * Formatted specifically for A5 size prescription pads.
 */

export const DEFAULT_PRESCRIPTION_CONFIG = {
  // Clinic Details
  clinicName: 'Suwa Sahana Medical Centre',
  clinicPhone: '0772582613',
  clinicAddress: '120 Galle Road, Colombo',
  clinicLogo: '', // Data URL or Image URL
  showClinicLogo: true,

  // Doctor Details
  doctorName: 'Dr. B.S. Pathum',
  doctorQualifications: 'MBBS (Peradeniya)',
  doctorRegNo: 'SLMC Reg no - 39737',

  // Prescription Title & Numbering
  rxTitle: 'Rx : (Outside)',
  refPrefix: 'DW',
  showQrCode: true,

  // Seal / Stamp
  sealType: 'digital', // 'digital' | 'image'
  sealImage: '',
  sealTitle: 'Dr. B. S. Pathum',
  sealDegree: 'MBBS (Peradeniya, Sri Lanka)',
  sealRegNo: 'SLMC Reg No: 39737',
  sealPhone: '077 2582613',
  showSeal: true,

  // Signature
  signatureImage: '',
  signatoryName: 'Dr. Shanaka Pathum',
  showSignature: true,

  // Footer branding
  footerBadgeText: 'GPClinic.lk'
};

const STORAGE_KEY_BASE = 'gp_clinic_prescription_config';

/**
 * Return the localStorage key scoped to the given doctorId.
 * Falls back to the legacy shared key if no doctorId is provided.
 */
function storageKey(doctorId) {
  return doctorId ? `${STORAGE_KEY_BASE}_${doctorId}` : STORAGE_KEY_BASE;
}

/**
 * Load prescription configuration from localStorage with fallback to default.
 * Pass doctorId to load the correct per-doctor config (new doctors get defaults).
 */
export function getSavedPrescriptionConfig(doctorId) {
  if (typeof window === 'undefined') return DEFAULT_PRESCRIPTION_CONFIG;
  try {
    const saved = localStorage.getItem(storageKey(doctorId));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.footerBadgeText === 'DocWallet.lk' || !parsed.footerBadgeText) {
        parsed.footerBadgeText = 'GPClinic.lk';
      }
      return { ...DEFAULT_PRESCRIPTION_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error('Error loading prescription config:', err);
  }
  // No saved config for this doctor — return clean defaults
  return DEFAULT_PRESCRIPTION_CONFIG;
}

/**
 * Save prescription configuration to localStorage, scoped to doctorId.
 */
export function savePrescriptionConfig(config, doctorId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(doctorId), JSON.stringify(config));
  } catch (err) {
    console.error('Error saving prescription config:', err);
  }
}

/**
 * Format patient age into "X Years Y Month(s)"
 */
export function formatPatientAge(ageY, ageM) {
  const years = parseInt(ageY) || 0;
  const months = parseInt(ageM) || 0;
  return `${years} Years ${months} Month(s)`;
}

/**
 * Generate formatted reference code (e.g. DW/260809/8)
 */
export function generateReferenceNo(prefix = 'DW', dateStr, queueNo = 1) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${prefix}/${yy}${mm}${dd}/${queueNo || 1}`;
}

/**
 * Build the complete HTML document for printing or previewing the prescription.
 * Enforces A5 portrait paper size with balanced spacing and enlarged typography.
 */
export function buildPrescriptionHtml({
  config = DEFAULT_PRESCRIPTION_CONFIG,
  patientName = 'Kamal Kumara',
  ageText = '0 Years 0 Month(s)',
  allergies = '',
  visitDate = new Date().toISOString().split('T')[0],
  queueNumber = 1,
  prescriptions = [],
  qrImageSrc = '',
  planOfAction = ''
}) {
  const refNo = generateReferenceNo(config.refPrefix || 'DW', visitDate, queueNumber);

  // Default Medical Cross Logo SVG if no custom image is uploaded
  const defaultLogoSvg = `
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="16" fill="#f8fafc"/>
      <path d="M38 20H62V38H80V62H62V80H38V62H20V38H38V20Z" fill="#ef4444"/>
      <circle cx="50" cy="50" r="18" fill="#1e3a8a"/>
      <path d="M46 42C46 39.79 47.79 38 50 38C52.21 38 54 39.79 54 42V58C54 60.21 52.21 62 50 62C47.79 62 46 60.21 46 58V42Z" fill="white"/>
      <path d="M42 46H58V54H42V46Z" fill="white"/>
    </svg>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prescription Pad - ${config.clinicName || 'GPClinic'}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background: #ffffff;
      margin: 0;
      padding: 0;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.35;
      padding: 4px 6px;
      font-size: 14px;
    }
    .prescription-container {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .header-logo-cell {
      width: 42%;
      vertical-align: top;
      text-align: left;
    }
    .header-info-cell {
      width: 58%;
      vertical-align: top;
      text-align: right;
    }
    .header-info-content {
      display: inline-block;
      text-align: left;
    }
    .clinic-logo-img {
      max-width: 140px;
      max-height: 65px;
      object-fit: contain;
      display: block;
      margin-bottom: 2px;
    }
    .clinic-name-header {
      font-size: 18.5px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
      letter-spacing: -0.2px;
    }
    .clinic-contact-header {
      font-size: 13.5px;
      font-weight: 700;
      color: #334155;
      margin: 0 0 5px 0;
    }
    .doc-name-header {
      font-size: 14.5px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 1px 0;
    }
    .doc-meta-header {
      font-size: 13px;
      color: #475569;
      margin: 0 0 1px 0;
      font-weight: 500;
    }
    .ref-divider-row {
      margin-top: 8px;
      margin-bottom: 12px;
    }
    .ref-no-text {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .header-hr {
      border: none;
      border-top: 1.5px solid #cbd5e1;
      margin: 0;
    }
    .patient-info-block {
      margin-bottom: 14px;
      font-size: 14px;
      line-height: 1.55;
    }
    .patient-row {
      display: flex;
      gap: 8px;
      color: #1e293b;
    }
    .patient-label {
      font-weight: 700;
      color: #0f172a;
      min-width: 65px;
    }
    .patient-val {
      font-weight: 500;
    }
    .rx-header-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .rx-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 8px;
    }
    .rx-th-row th {
      background: #bae6fd;
      color: #0369a1;
      font-size: 13.5px;
      font-weight: 800;
      padding: 6px 12px;
      text-align: left;
    }
    .rx-th-row th:first-child {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
      width: 48%;
    }
    .rx-th-row th:nth-child(2) {
      width: 26%;
    }
    .rx-th-row th:last-child {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
      width: 26%;
    }
    .rx-item-tr td {
      padding: 9px 12px;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
      color: #1e293b;
      vertical-align: top;
    }
    .rx-item-name {
      font-weight: 700;
      color: #0f172a;
    }
    .rx-item-dosage {
      font-weight: 600;
      color: #334155;
    }
    .rx-item-duration {
      font-weight: 600;
      color: #475569;
    }
    /* Comfortable little space between medicine table and bottom sign-off area */
    .bottom-sign-area {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 4px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .sign-left-col {
      width: 50%;
    }
    .sign-date-row {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .stamp-container {
      margin-top: 4px;
    }
    .digital-seal-box {
      display: inline-block;
      border: 1.5px solid #1d4ed8;
      border-radius: 6px;
      padding: 6px 12px;
      color: #1d4ed8;
      text-align: center;
      background: rgba(37, 99, 235, 0.02);
      transform: rotate(-1.5deg);
    }
    .seal-title-text {
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 1px;
      letter-spacing: 0.3px;
    }
    .seal-sub-text {
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 1px;
    }
    .sign-right-col {
      width: 45%;
      text-align: right;
    }
    .auth-sign-label {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .signature-img-wrapper {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: 2px;
    }
    .signature-img {
      max-height: 50px;
      max-width: 150px;
      object-fit: contain;
    }
    .sig-dotted-line {
      border-bottom: 1.5px dotted #64748b;
      width: 165px;
      margin-left: auto;
      margin-bottom: 3px;
    }
    .signatory-name-text {
      font-size: 12.5px;
      font-weight: 700;
      color: #1e293b;
      text-align: right;
    }
    .docwallet-footer-badge {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      margin-top: 18px;
      font-size: 10.5px;
      color: #0284c7;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .docwallet-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 3px 8px;
      border-radius: 5px;
      font-weight: 700;
      font-size: 10px;
    }

    @media print {
      @page {
        size: A5 portrait;
        margin: 8mm 10mm 8mm 10mm;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }
      .prescription-container {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
      }
    }
  </style>
</head>
<body onload="window.print(); window.close();">
  <div class="prescription-container">
    <div>
      <!-- TOP HEADER -->
      <table class="header-table">
        <tr>
          <!-- Top Left: Clinic Logo -->
          <td class="header-logo-cell">
            ${config.showClinicLogo ? `
              ${config.clinicLogo ? `
                <img src="${config.clinicLogo}" alt="Clinic Logo" class="clinic-logo-img" />
              ` : `
                ${defaultLogoSvg}
              `}
            ` : ''}
          </td>

          <!-- Top Right: Clinic Info & Doctor Header Details -->
          <td class="header-info-cell">
            <div class="header-info-content">
              <h1 class="clinic-name-header">${config.clinicName || 'Suwa Sahana Medical Centre'}</h1>
              <div class="clinic-contact-header">T.P - ${config.clinicPhone || '0772582613'}</div>
              <div class="doc-name-header">${config.doctorName || 'Dr. B.S. Pathum'}</div>
              <div class="doc-meta-header">${config.doctorQualifications || 'MBBS (Peradeniya)'}</div>
              <div class="doc-meta-header">${config.doctorRegNo || 'SLMC Reg no - 39737'}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- REF NO & DIVIDER -->
      <div class="ref-divider-row">
        <div class="ref-no-text">Ref No: ${refNo}</div>
        <hr class="header-hr" />
      </div>

      <!-- PATIENT DETAILS -->
      <div class="patient-info-block">
        <div class="patient-row">
          <span class="patient-label">Name :</span>
          <span class="patient-val">${patientName || 'Walk-in Patient'}</span>
        </div>
        <div class="patient-row">
          <span class="patient-label">Age :</span>
          <span class="patient-val">${ageText}</span>
        </div>
        ${allergies ? `
          <div class="patient-row" style="color: #dc2626; font-weight: bold; margin-top: 2px;">
            <span class="patient-label" style="color: #dc2626;">Allergies :</span>
            <span>${allergies}</span>
          </div>
        ` : ''}
      </div>

      <!-- RX MEDICINE PRESCRIPTION TABLE -->
      <div>
        <div class="rx-header-title">${config.rxTitle || 'Rx : (Outside)'}</div>
        <table class="rx-table">
          <thead>
            <tr class="rx-th-row">
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${prescriptions && prescriptions.length > 0 ? prescriptions.map(item => `
              <tr class="rx-item-tr">
                <td><span class="rx-item-name">${item.medicine_name}</span></td>
                <td><span class="rx-item-dosage">${item.dosage}</span></td>
                <td><span class="rx-item-duration">${item.duration_days} Days</span></td>
              </tr>
            `).join('') : `
              <tr class="rx-item-tr">
                <td colspan="3" style="color: #64748b; font-style: italic; text-align: center; padding: 18px;">
                  No medicine items issued on this prescription.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      ${planOfAction ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-top: 8px; font-size: 12.5px; page-break-inside: avoid;">
          <strong style="color: #0369a1;">Clinical Advice / Next Plan:</strong> ${planOfAction}
        </div>
      ` : ''}
    </div>

    <!-- BOTTOM SIGN-OFF, SEAL & FOOTER -->
    <div>
      <div class="bottom-sign-area">
        <!-- Date & Doctor Seal -->
        <div class="sign-left-col">
          <div class="sign-date-row">Date: <strong>${visitDate}</strong></div>
          ${config.showSeal ? `
            <div class="stamp-container">
              ${config.sealType === 'image' && config.sealImage ? `
                <img src="${config.sealImage}" alt="Doctor Stamp" style="max-height: 80px; max-width: 190px; object-fit: contain;" />
              ` : `
                <div class="digital-seal-box">
                  <div class="seal-title-text">${config.sealTitle || config.doctorName || 'Dr. B. S. Pathum'}</div>
                  <div class="seal-sub-text">${config.sealDegree || config.doctorQualifications || 'MBBS (Peradeniya, Sri Lanka)'}</div>
                  <div class="seal-sub-text">${config.sealRegNo || config.doctorRegNo || 'SLMC Reg No: 39737'}</div>
                  <div class="seal-sub-text">☎ ${config.sealPhone || config.clinicPhone || '077 2582613'}</div>
                </div>
              `}
            </div>
          ` : ''}
        </div>

        <!-- Authorized Signature -->
        <div class="sign-right-col">
          ${config.showSignature ? `
            <div class="auth-sign-label">Authorized Signature :</div>
            <div class="signature-img-wrapper">
              ${config.signatureImage ? `
                <img src="${config.signatureImage}" alt="Signature" class="signature-img" />
              ` : `
                <div style="height: 32px; font-family: 'Brush Script MT', cursive, sans-serif; font-size: 22px; color: #1e3a8a;">
                  ${config.signatoryName || 'Dr. Pathum'}
                </div>
              `}
            </div>
            <div class="sig-dotted-line"></div>
            <div class="signatory-name-text">${config.signatoryName || config.doctorName || 'Dr. Shanaka Pathum'}</div>
          ` : ''}
        </div>
      </div>

      <!-- FOOTER BADGE -->
      <div class="docwallet-footer-badge">
        <span style="color: #64748b; font-size: 10px;">Powered by</span>
        <div class="docwallet-badge-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          ${config.footerBadgeText || 'GPClinic.lk'}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
