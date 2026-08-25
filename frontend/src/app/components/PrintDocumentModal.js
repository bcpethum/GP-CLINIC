'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  Printer,
  MessageSquare,
  FileText,
  Pill,
  DollarSign,
  BarChart2,
  Send,
  ClipboardEdit,
  User,
  Calendar,
  ChevronDown,
  Shield,
  Clipboard,
  Link2,
  Copy,
  CheckCheck,
  X,
} from 'lucide-react';
import {
  getSavedPrescriptionConfig,
  formatPatientAge,
  buildPrescriptionHtml,
  buildMedicalCertificateHtml,
  buildMedicalBillHtml,
  buildMedicalReportHtml,
  buildReferralLetterHtml,
  buildCustomDocumentHtml,
} from '../lib/prescriptionConfig';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const QUICK_BUTTONS = [
  { label: 'Referral', type: 'Referral' },
  { label: 'Financial Support', type: 'Financial Support' },
  { label: 'Fitness', type: 'Fitness' },
  { label: 'Ultrasound Scan', type: 'Ultrasound Scan' },
  { label: 'Medical Examination', type: 'Medical Examination' },
  { label: 'Investigation', type: 'Investigation' },
  { label: 'Consent Form', type: 'Consent Form' },
];

const DOC_TYPES = [
  {
    id: 'medical_certificate',
    title: 'Medical Certificates',
    description: "Verify a patient's medical condition for various purposes such as sick leave, disability claims or insurance purposes.",
    icon: FileText,
    iconColor: '#3b82f6',
    color: '#ffffff',
    accent: '#0284c7',
  },
  {
    id: 'outside_prescription',
    title: 'Outside Prescriptions',
    description: "Involves authorizing medication for patients, typically specifying the medication's name, dosage & instructions.",
    icon: Pill,
    iconColor: '#8b5cf6',
    color: '#ffffff',
    accent: '#0284c7',
  },
  {
    id: 'medical_bill',
    title: 'Medical Bill',
    description: 'Detailing the cost of medical services provided to patients & payment information.',
    icon: DollarSign,
    iconColor: '#10b981',
    color: '#ffffff',
    accent: '#0284c7',
  },
  {
    id: 'medical_report',
    title: 'Medical Report',
    description: "Patient's medical history, including diagnoses, treatments, medications, and other relevant information.",
    icon: BarChart2,
    iconColor: '#f59e0b',
    color: '#ffffff',
    accent: '#0284c7',
  },
  {
    id: 'referral',
    title: 'Referrals & Other',
    description: 'Medical referrals connect patients to specialists, sharing essential health details for focused care.',
    icon: Send,
    iconColor: '#06b6d4',
    color: '#ffffff',
    accent: '#0284c7',
  },
  {
    id: 'custom_document',
    title: 'Custom Document',
    description: 'Type any content and generate a printable or digital document for patient or official use.',
    icon: ClipboardEdit,
    iconColor: '#ec4899',
    color: '#ffffff',
    accent: '#0284c7',
  },
];

/* ── Light Theme Shared Input Style ── */
const inp = {
  width: '100%',
  background: '#ffffff',
  border: '1.5px solid #38bdf8',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '0.88rem',
  color: '#1e293b',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const label = {
  fontSize: '0.74rem',
  color: '#475569',
  fontWeight: 600,
  textTransform: 'none',
  letterSpacing: '0.2px',
  marginBottom: '5px',
  display: 'block',
};

const checkRow = (checked, onChange, text) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.86rem', color: '#334155', userSelect: 'none', fontWeight: 500 }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0284c7' }}
    />
    {text}
  </label>
);

const PAGE_SIZES = ['A5', 'A4', 'Letter'];
const RESIDENCE_TYPES = ['Residence', 'Work', 'School', 'Other'];

export default function PrintDocumentModal({
  isOpen,
  onClose,
  userId,
  patientName,
  patientTel = '',
  ageY,
  ageM,
  visitDate,
  queueNumber,
  prescriptions = [],
  diagnosis = '',
  nextVisitPlan = '',
  consultationFee = 0,
  totalBill = 0,
  isFoc = false,
  investigations = {},
  qrCodeData = '',
}) {
  const [selectedDoc, setSelectedDoc] = useState('outside_prescription');

  /* ── Shared ── */
  const [pageSize, setPageSize] = useState('A5');
  const [removeHeader, setRemoveHeader] = useState(false);
  const [removeFooter, setRemoveFooter] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [includeNextVisit, setIncludeNextVisit] = useState(false);
  const [includePastHistory, setIncludePastHistory] = useState(false);

  /* ── Medical Certificate ── */
  const [residenceType, setResidenceType] = useState('Residence');
  const [residencePlace, setResidencePlace] = useState('');
  const [consultDate, setConsultDate] = useState(visitDate || '');
  const [fromDate, setFromDate] = useState(visitDate || '');
  const [toDate, setToDate] = useState(visitDate || '');
  const [signsSymptoms, setSignsSymptoms] = useState('');

  /* ── Outside Prescription ── */
  const [rxInside, setRxInside] = useState(false);
  const [rxOutside, setRxOutside] = useState(true);

  /* ── Medical Bill ── */
  const [detailedBill, setDetailedBill] = useState(false);

  /* ── Referral ── */
  const [referralType, setReferralType] = useState('');
  const [referralNote, setReferralNote] = useState('');

  /* ── Custom ── */
  const [customContent, setCustomContent] = useState('');

  /* ── Share Link state ── */
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePopup, setSharePopup] = useState(null); // { url, expires_at }
  const [linkCopied, setLinkCopied] = useState(false);

  /* ── SMS state ── */
  const [smsPhone, setSmsPhone] = useState(patientTel);
  const [smsStatus, setSmsStatus] = useState('idle'); // 'idle' | 'generating' | 'sending' | 'sent' | 'error'
  const [smsMessage, setSmsMessage] = useState('');
  const [showSmsInput, setShowSmsInput] = useState(false);
  const [showSmsInModal, setShowSmsInModal] = useState(false); // SMS panel inside share modal

  if (!isOpen) return null;

  const ageFormatted = formatPatientAge(ageY, ageM);
  const config = getSavedPrescriptionConfig(userId);

  const handleQuickBtn = (type) => {
    setReferralType(type);
    setSelectedDoc('referral');
  };

  const handlePrint = async () => {
    let htmlContent = '';

    if (selectedDoc === 'outside_prescription') {
      let qrImageSrc = '';
      if (qrCodeData) {
        try {
          const QRCode = (await import('qrcode')).default;
          qrImageSrc = await QRCode.toDataURL(qrCodeData);
        } catch (err) { console.error('QR error:', err); }
      }
      htmlContent = buildPrescriptionHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        ageText: ageFormatted,
        allergies: '',
        visitDate: consultDate,
        queueNumber,
        prescriptions,
        qrImageSrc,
        planOfAction: remarks || nextVisitPlan,
        includeNextVisit,
        includePastHistory,
      });
    } else if (selectedDoc === 'medical_certificate') {
      htmlContent = buildMedicalCertificateHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        ageText: ageFormatted,
        visitDate: consultDate,
        queueNumber,
        diagnosis,
        referralNote: remarks,
        residenceType,
        residencePlace,
        fromDate,
        toDate,
        signsSymptoms,
      });
    } else if (selectedDoc === 'medical_bill') {
      htmlContent = buildMedicalBillHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        ageText: ageFormatted,
        visitDate,
        queueNumber,
        prescriptions,
        consultationFee,
        totalBill,
        isFoc,
        detailedBill,
        includeNextVisit,
        includePastHistory,
        remarks,
      });
    } else if (selectedDoc === 'medical_report') {
      htmlContent = buildMedicalReportHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        ageText: ageFormatted,
        visitDate,
        queueNumber,
        diagnosis,
        prescriptions,
        referralNote: remarks,
        investigations,
        includePastHistory,
      });
    } else if (selectedDoc === 'referral') {
      htmlContent = buildReferralLetterHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        ageText: ageFormatted,
        visitDate,
        queueNumber,
        diagnosis,
        referralNote,
        referralType: referralType || 'Referral',
      });
    } else if (selectedDoc === 'custom_document') {
      htmlContent = buildCustomDocumentHtml({
        config,
        patientName: patientName || 'Walk-in Patient',
        visitDate,
        queueNumber,
        customContent,
      });
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  // ── Build the same HTML and post to backend to get a shareable link ──
  const handleShareLink = async () => {
    let htmlContent = '';

    if (selectedDoc === 'outside_prescription') {
      let qrImageSrc = '';
      if (qrCodeData) {
        try {
          const QRCode = (await import('qrcode')).default;
          qrImageSrc = await QRCode.toDataURL(qrCodeData);
        } catch (err) { console.error('QR error:', err); }
      }
      htmlContent = buildPrescriptionHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, allergies: '', visitDate: consultDate, queueNumber, prescriptions, qrImageSrc, planOfAction: remarks || nextVisitPlan, includeNextVisit, includePastHistory });
    } else if (selectedDoc === 'medical_certificate') {
      htmlContent = buildMedicalCertificateHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate: consultDate, queueNumber, diagnosis, referralNote: remarks, residenceType, residencePlace, fromDate, toDate, signsSymptoms });
    } else if (selectedDoc === 'medical_bill') {
      htmlContent = buildMedicalBillHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, prescriptions, consultationFee, totalBill, isFoc, detailedBill, includeNextVisit, includePastHistory, remarks });
    } else if (selectedDoc === 'medical_report') {
      htmlContent = buildMedicalReportHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, diagnosis, prescriptions, referralNote: remarks, investigations, includePastHistory });
    } else if (selectedDoc === 'referral') {
      htmlContent = buildReferralLetterHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, diagnosis, referralNote, referralType: referralType || 'Referral' });
    } else if (selectedDoc === 'custom_document') {
      htmlContent = buildCustomDocumentHtml({ config, patientName: patientName || 'Walk-in Patient', visitDate, queueNumber, customContent });
    }

    if (!htmlContent) return;

    // Strip auto-print onload — patient should just view the document
    const shareHtml = htmlContent.replace(/(<body)[^>]*(>)/i, '$1$2');

    try {
      setShareLoading(true);
      setSharePopup(null);
      const token = localStorage.getItem('gp_clinic_token');
      const res = await fetch(`${API_BASE}/documents/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          html: shareHtml,
          doc_type: selectedDoc,
          patient_name: patientName || 'Walk-in Patient',
          expiry_hours: 48,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');
      setSharePopup({ url: data.url, expires_at: data.expires_at });
    } catch (err) {
      alert('Could not generate share link: ' + err.message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!sharePopup?.url) return;
    navigator.clipboard.writeText(sharePopup.url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  // ── Generate a share link then SMS it to the patient ──
  const handleSendViaSms = async () => {
    const phone = smsPhone.trim();
    if (!phone) {
      setSmsMessage('Please enter a phone number.');
      setSmsStatus('error');
      return;
    }

    try {
      setSmsStatus('generating');
      setSmsMessage('Generating document link...');

      // Build the same HTML as handleShareLink
      let htmlContent = '';
      if (selectedDoc === 'outside_prescription') {
        let qrImageSrc = '';
        if (qrCodeData) {
          try { const QRCode = (await import('qrcode')).default; qrImageSrc = await QRCode.toDataURL(qrCodeData); } catch { }
        }
        htmlContent = buildPrescriptionHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, allergies: '', visitDate: consultDate, queueNumber, prescriptions, qrImageSrc, planOfAction: remarks || nextVisitPlan, includeNextVisit, includePastHistory });
      } else if (selectedDoc === 'medical_certificate') {
        htmlContent = buildMedicalCertificateHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate: consultDate, queueNumber, diagnosis, referralNote: remarks, residenceType, residencePlace, fromDate, toDate, signsSymptoms });
      } else if (selectedDoc === 'medical_bill') {
        htmlContent = buildMedicalBillHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, prescriptions, consultationFee, totalBill, isFoc, detailedBill, includeNextVisit, includePastHistory, remarks });
      } else if (selectedDoc === 'medical_report') {
        htmlContent = buildMedicalReportHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, diagnosis, prescriptions, referralNote: remarks, investigations, includePastHistory });
      } else if (selectedDoc === 'referral') {
        htmlContent = buildReferralLetterHtml({ config, patientName: patientName || 'Walk-in Patient', ageText: ageFormatted, visitDate, queueNumber, diagnosis, referralNote, referralType: referralType || 'Referral' });
      } else if (selectedDoc === 'custom_document') {
        htmlContent = buildCustomDocumentHtml({ config, patientName: patientName || 'Walk-in Patient', visitDate, queueNumber, customContent });
      }

      if (!htmlContent) {
        setSmsStatus('error');
        setSmsMessage('No document content to send.');
        return;
      }

      const shareHtml = htmlContent.replace(/(<body)[^>]*(>)/i, '$1$2');
      const authToken = localStorage.getItem('gp_clinic_token');

      // Step 1: Generate shareable link
      const linkRes = await fetch(`${API_BASE}/documents/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ html: shareHtml, doc_type: selectedDoc, patient_name: patientName || 'Walk-in Patient', expiry_hours: 48 }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error || 'Failed to generate link');

      // Step 2: Send via SMS
      setSmsStatus('sending');
      setSmsMessage('Sending SMS...');

      const docTypeLabel = { outside_prescription: 'Prescription', medical_certificate: 'Medical Certificate', medical_bill: 'Medical Bill', medical_report: 'Medical Report', referral: 'Referral Letter', custom_document: 'Document' }[selectedDoc] || 'Document';
      const smsText = `Your ${docTypeLabel} from ${config.clinicName || 'GP Clinic'} is ready. View here: ${linkData.url} (Link valid 48 hrs)`;

      const smsRes = await fetch(`${API_BASE}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ contact: phone, message: smsText }),
      });
      const smsData = await smsRes.json();
      if (!smsRes.ok || smsData.success === false) throw new Error(smsData.message || 'SMS sending failed');

      setSmsStatus('sent');
      setSmsMessage(`✓ SMS sent to ${phone}`);
      setTimeout(() => { setSmsStatus('idle'); setSmsMessage(''); setShowSmsInput(false); }, 4000);
    } catch (err) {
      setSmsStatus('error');
      setSmsMessage(err.message);
    }
  };


  const renderLeftPanel = () => {
    const PatientDisplay = (
      <div>
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #38bdf8',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '0.92rem',
          color: '#1e293b',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{patientName || 'Walk-in Patient'}</span>
          <User size={16} color="#0284c7" />
        </div>
      </div>
    );

    const PageSizeRow = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 500 }}>Page Size :</span>
        <div style={{ position: 'relative', width: '100px' }}>
          <select
            value={pageSize}
            onChange={e => setPageSize(e.target.value)}
            style={{ ...inp, padding: '6px 28px 6px 12px', appearance: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#0284c7', pointerEvents: 'none' }} />
        </div>
      </div>
    );

    const HeaderFooterRow = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 500 }}>Remove Header /Footer :</span>
        <div style={{ display: 'flex', gap: '14px' }}>
          {checkRow(removeHeader, setRemoveHeader, 'Header')}
          {checkRow(removeFooter, setRemoveFooter, 'Footer')}
        </div>
      </div>
    );

    const RemarksField = (placeholder = 'Remarks / Next Visit plans / Others') => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
        <div style={{ ...label }}>{placeholder}</div>
        <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
          <textarea
            className="pdm-textarea"
            rows={5}
            placeholder={placeholder + '...'}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            style={{ flex: 1 }}
          />
          <Clipboard size={15} style={{ position: 'absolute', right: 10, bottom: 10, color: '#94a3b8', pointerEvents: 'none' }} />
        </div>
      </div>
    );

    if (selectedDoc === 'medical_certificate') {
      return (
        <>
          {PatientDisplay}

          {/* Residence + Place */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <select
                value={residenceType}
                onChange={e => setResidenceType(e.target.value)}
                style={{ ...inp, appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}
              >
                {RESIDENCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#0284c7', pointerEvents: 'none' }} />
            </div>
            <div>
              <input
                type="text"
                placeholder="Place"
                value={residencePlace}
                onChange={e => setResidencePlace(e.target.value)}
                style={inp}
              />
            </div>
          </div>

          {/* Consultation Date */}
          <div>
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block' }}>Consultation Date :</span>
                <span style={{ fontSize: '0.9rem', color: '#0284c7', fontWeight: 600 }}>{consultDate || '2026-08-14'}</span>
              </div>
              <Calendar size={18} color="#0284c7" />
            </div>
          </div>

          {/* From / To Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>From :</span>
                <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>{fromDate || '2026-08-14'}</span>
              </div>
              <Calendar size={15} color="#0284c7" />
            </div>
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #38bdf8',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>To :</span>
                <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>{toDate || '2026-08-14'}</span>
              </div>
              <Calendar size={15} color="#0284c7" />
            </div>
          </div>

          {/* Signs & Symptoms */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Signs and Symptoms"
              value={signsSymptoms}
              onChange={e => setSignsSymptoms(e.target.value)}
              style={{ ...inp, paddingRight: '32px' }}
            />
            <Shield size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {/* Diagnosis display */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              readOnly
              value={diagnosis || 'Rhinitis'}
              style={{ ...inp, paddingRight: '32px', background: '#f8fafc', color: '#334155' }}
            />
            <Shield size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {PageSizeRow}
          {HeaderFooterRow}
        </>
      );
    }

    if (selectedDoc === 'outside_prescription') {
      return (
        <>
          {PatientDisplay}

          {/* Diagnosis */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              readOnly
              value={diagnosis || 'Rhinitis'}
              style={{ ...inp, paddingRight: '32px', background: '#f8fafc', color: '#334155' }}
            />
            <Shield size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {/* Prescription: Inside / Outside */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 500 }}>Prescription :</span>
            <div style={{ display: 'flex', gap: '14px' }}>
              {checkRow(rxInside, setRxInside, 'Inside')}
              {checkRow(rxOutside, setRxOutside, 'Outside')}
            </div>
          </div>

          {PageSizeRow}
          {HeaderFooterRow}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {checkRow(includeNextVisit, setIncludeNextVisit, 'Include Next Visit Date :')}
            {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History :')}
          </div>

          {RemarksField('Remarks / Next Visit plans / Others')}
        </>
      );
    }

    if (selectedDoc === 'medical_bill') {
      return (
        <>
          {PatientDisplay}

          {/* Diagnosis */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              readOnly
              value={diagnosis || 'Rhinitis'}
              style={{ ...inp, paddingRight: '32px', background: '#f8fafc', color: '#334155' }}
            />
            <Shield size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>

          {PageSizeRow}
          {HeaderFooterRow}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {checkRow(detailedBill, setDetailedBill, 'Enable Detailed Bill :')}
            {checkRow(includeNextVisit, setIncludeNextVisit, 'Include Next Visit Date :')}
            {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History :')}
          </div>

          {RemarksField('Remarks / Next Visit plans / Others')}
        </>
      );
    }

    if (selectedDoc === 'medical_report') {
      return (
        <>
          {PatientDisplay}
          {PageSizeRow}
          {HeaderFooterRow}
          <div>
            {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History :')}
          </div>
        </>
      );
    }

    if (selectedDoc === 'referral') {
      return (
        <>
          {PatientDisplay}

          {/* Quick Select Pills */}
          <div>
            <div style={{ ...label, color: '#0284c7', fontWeight: 700 }}>Quick Select</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUICK_BUTTONS.map(btn => (
                <button
                  key={btn.type}
                  className={`pdm-quick-btn${referralType === btn.type ? ' active' : ''}`}
                  onClick={() => handleQuickBtn(btn.type)}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {PageSizeRow}
          {HeaderFooterRow}

          {/* Notes */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '130px' }}>
            <div style={{ ...label }}>Notes / Referral Details</div>
            <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
              <textarea
                className="pdm-textarea"
                rows={6}
                placeholder="Referral reason, specialist, notes..."
                value={referralNote}
                onChange={e => setReferralNote(e.target.value)}
                style={{ flex: 1 }}
              />
              <Clipboard size={15} style={{ position: 'absolute', right: 10, bottom: 10, color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
        </>
      );
    }

    if (selectedDoc === 'custom_document') {
      return (
        <>
          {PatientDisplay}
          {PageSizeRow}
          {HeaderFooterRow}

          {/* Custom Content Textarea */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '180px' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
              <textarea
                className="pdm-textarea"
                rows={9}
                placeholder="Type your custom document here..."
                value={customContent}
                onChange={e => setCustomContent(e.target.value)}
                style={{ flex: 1, fontStyle: 'italic' }}
              />
              <Shield size={16} style={{ position: 'absolute', right: 10, bottom: 10, color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        padding: '0',
      }}
    >
      <style>{`
        @keyframes pdmFadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .pdm-wrap { animation: pdmFadeIn 0.18s ease-out; }
        
        .pdm-doc-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          background: #ffffff;
          border: 1.5px solid #38bdf8;
          border-radius: 16px;
          padding: 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
        }
        
        .pdm-doc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(2, 132, 199, 0.12);
          border-color: #0284c7;
        }

        .pdm-doc-card.selected {
          border: 2px solid #0090b8 !important;
          box-shadow: 0 0 24px rgba(6, 182, 212, 0.35) !important;
          background: #ffffff !important;
        }
        
        .pdm-quick-btn {
          transition: all 0.15s ease;
          cursor: pointer;
          border: 1.5px solid #38bdf8;
          background: #f0f9ff;
          color: #0284c7;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
        }
        
        .pdm-quick-btn:hover {
          background: #e0f2fe;
          border-color: #0284c7;
          color: #0369a1;
        }
        
        .pdm-quick-btn.active {
          background: #0284c7;
          border-color: #0284c7;
          color: #ffffff;
        }
        
        .pdm-textarea {
          width: 100%;
          background: #ffffff;
          border: 1.5px solid #38bdf8;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 0.88rem;
          color: #1e293b;
          resize: vertical;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        
        .pdm-textarea:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
        
        .pdm-print-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #008db9;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          padding: 12px 18px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
          box-shadow: 0 4px 14px rgba(0, 141, 185, 0.25);
          width: 100%;
        }
        
        .pdm-print-btn:hover {
          background: #007a9f;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 141, 185, 0.35);
        }
        
        .pdm-sms-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #008db9;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          padding: 12px 18px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s;
          box-shadow: 0 4px 14px rgba(0, 141, 185, 0.25);
          width: 100%;
        }
        
        .pdm-sms-btn:hover {
          background: #007a9f;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 141, 185, 0.35);
        }
        
        .pdm-back-btn {
          background: #ffffff;
          border: 1.5px solid #38bdf8;
          border-radius: 8px;
          color: #0284c7;
          cursor: pointer;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        
        .pdm-back-btn:hover {
          background: #f0f9ff;
          border-color: #0284c7;
        }
      `}</style>

      <div className="pdm-wrap" style={{
        background: '#ffffff',
        border: 'none',
        borderRadius: '0',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Top Header Bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid #f1f5f9',
          background: '#ffffff',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button className="pdm-back-btn" onClick={onClose} title="Back">
              <ChevronLeft size={22} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#008db9', letterSpacing: '-0.3px' }}>
                Print Your Document here
              </h2>
            </div>
          </div>
        </div>

        {/* ── Main Layout Body ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          flex: 1,
          overflow: 'hidden',
          background: '#ffffff',
        }}>

          {/* LEFT PANEL — Dynamic Controls Per Doc Type */}
          <div style={{
            borderRight: '1px solid #f1f5f9',
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            background: '#ffffff',
          }}>
            {renderLeftPanel()}

            {/* Action Buttons: Print + Send via SMS + Share Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '16px' }}>
              <button className="pdm-print-btn" onClick={handlePrint}>
                Print <Printer size={17} style={{ marginLeft: 4 }} />
              </button>
              {/* Send via SMS — expandable panel */}
              <button
                className="pdm-sms-btn"
                onClick={() => { setShowSmsInput(s => !s); setSmsStatus('idle'); setSmsMessage(''); setSmsPhone(patientTel); }}
              >
                Send via SMS <MessageSquare size={16} style={{ marginLeft: 4 }} />
              </button>

              {/* SMS input panel */}
              {showSmsInput && (
                <div style={{
                  background: '#f0f9ff', border: '1.5px solid #bae6fd',
                  borderRadius: '12px', padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0369a1' }}>
                    📱 Send Document Link via SMS
                  </div>

                  {/* Phone number input */}
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                      Patient Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={smsPhone}
                      onChange={e => setSmsPhone(e.target.value)}
                      placeholder="e.g. 0771234567"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        border: '1.5px solid #38bdf8', background: '#ffffff',
                        fontSize: '0.9rem', color: '#1e293b', fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Status message */}
                  {smsMessage && (
                    <div style={{
                      fontSize: '0.75rem', padding: '6px 10px', borderRadius: '7px',
                      background: smsStatus === 'sent' ? '#dcfce7' : smsStatus === 'error' ? '#fee2e2' : '#e0f2fe',
                      color: smsStatus === 'sent' ? '#15803d' : smsStatus === 'error' ? '#dc2626' : '#0284c7',
                      fontWeight: '600',
                    }}>
                      {smsMessage}
                    </div>
                  )}

                  {/* Send button */}
                  <button
                    onClick={handleSendViaSms}
                    disabled={smsStatus === 'generating' || smsStatus === 'sending' || smsStatus === 'sent'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '9px 14px', borderRadius: '8px', border: 'none', cursor:
                        (smsStatus === 'generating' || smsStatus === 'sending' || smsStatus === 'sent') ? 'not-allowed' : 'pointer',
                      background: smsStatus === 'sent' ? '#10b981' : '#0284c7',
                      color: '#ffffff', fontWeight: '700', fontSize: '0.88rem',
                      transition: 'background 0.2s',
                      opacity: (smsStatus === 'generating' || smsStatus === 'sending') ? 0.75 : 1,
                    }}
                  >
                    <MessageSquare size={15} />
                    {smsStatus === 'generating' ? 'Generating link...'
                      : smsStatus === 'sending' ? 'Sending SMS...'
                        : smsStatus === 'sent' ? '✓ Sent!'
                          : 'Send SMS'}
                  </button>

                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
                    A link valid for 48 hours will be sent to the patient
                  </div>
                </div>
              )}

              {/* Share Link Button */}
              <button
                onClick={handleShareLink}
                disabled={shareLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '10px 16px', borderRadius: '9px', cursor: shareLoading ? 'not-allowed' : 'pointer',
                  border: '1.5px solid #0ea5e9', background: '#f0f9ff',
                  color: '#0284c7', fontWeight: '700', fontSize: '0.9rem',
                  transition: 'all 0.18s', opacity: shareLoading ? 0.7 : 1,
                }}
              >
                <Link2 size={16} />
                {shareLoading ? 'Generating...' : 'Share Link'}
              </button>

              {/* Share Modal Overlay — shown after link is generated */}
              {sharePopup && (
                <div
                  onClick={(e) => { if (e.target === e.currentTarget) { setSharePopup(null); setLinkCopied(false); } }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                  }}
                >
                  <div style={{
                    background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.22)', overflow: 'hidden',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}>
                    {/* Modal Header */}
                    <div style={{
                      padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>Share</span>
                      <button
                        onClick={() => { setSharePopup(null); setLinkCopied(false); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* URL + Copy Link bar */}
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                        padding: '10px 14px',
                      }}>
                        <Link2 size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                        <a
                          href={sharePopup.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.8rem', color: '#0284c7', flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: 'monospace', textDecoration: 'underline', cursor: 'pointer',
                          }}
                          title={sharePopup.url}
                        >
                          {sharePopup.url}
                        </a>
                        <button
                          onClick={handleCopyLink}
                          style={{
                            background: linkCopied ? '#10b981' : '#0ea5e9',
                            color: '#fff', border: 'none', borderRadius: '7px',
                            padding: '6px 14px', cursor: 'pointer', fontWeight: '700',
                            fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px',
                            transition: 'background 0.2s', flexShrink: 0,
                          }}
                        >
                          {linkCopied ? <><CheckCheck size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px', textAlign: 'right' }}>
                        ⏰ Expires {new Date(sharePopup.expires_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Share with others — social grid */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '14px' }}>
                        Share with others
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {[
                          {
                            label: 'WhatsApp', bg: '#25D366', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.12 1.524 5.854L.057 23.8a.5.5 0 0 0 .624.598l6.082-1.596A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.67-.535-5.176-1.46l-.371-.22-3.857 1.013 1.032-3.747-.243-.385A9.94 9.94 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                            ), href: `https://wa.me/?text=${encodeURIComponent('Your medical document: ' + sharePopup.url)}`
                          },
                          {
                            label: 'Facebook', bg: '#1877F2', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.093 24 18.1 24 12.073z" /></svg>
                            ), href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePopup.url)}`
                          },
                          {
                            label: 'Twitter', bg: '#000000', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            ), href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePopup.url)}&text=${encodeURIComponent('Your medical document is ready:')}`
                          },
                          {
                            label: 'Gmail', bg: '#EA4335', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h.749l9.615 6.818 9.615-6.818h.749A1.636 1.636 0 0 1 24 5.457z" /></svg>
                            ), href: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Your Medical Document')}&body=${encodeURIComponent('Please find your medical document at: ' + sharePopup.url)}`
                          },
                          {
                            label: 'LinkedIn', bg: '#0A66C2', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            ), href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sharePopup.url)}`
                          },
                          {
                            label: 'Outlook', bg: '#0078D4', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.07.04.07.12l.13.31zM9.5 15.02l1.44-.7q.06-.03.06-.07 0-.04-.06-.06l-1.44-.69V15.02zm9.12-7.32H8.37v5.63l1.5.73q.19.09.19.32v2.47h8.56V7.7zm3.07 7.44l-2.5-1.43V9.14l2.5 1.43v4.57z" /></svg>
                            ), href: `mailto:?subject=${encodeURIComponent('Your Medical Document')}&body=${encodeURIComponent('Please find your document here: ' + sharePopup.url)}`
                          },
                          {
                            label: 'Windows\nShare', bg: '#737373', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z" /></svg>
                            ), href: null
                          },
                          {
                            label: 'Mail app', bg: '#6366f1', icon: (
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                            ), href: `mailto:?subject=${encodeURIComponent('Your Medical Document')}&body=${encodeURIComponent('Please open your document: ' + sharePopup.url)}`
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (!item.href) {
                                if (navigator.share) {
                                  navigator.share({ title: 'Medical Document', url: sharePopup.url }).catch(() => { });
                                } else {
                                  handleCopyLink();
                                }
                              } else {
                                window.open(item.href, '_blank', 'noopener,noreferrer');
                              }
                            }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            }}
                          >
                            <div style={{
                              width: 48, height: 48, borderRadius: '12px',
                              background: item.bg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            }}>
                              {item.icon}
                            </div>
                            <span style={{
                              fontSize: '0.68rem', color: '#475569', fontWeight: '500',
                              textAlign: 'center', whiteSpace: 'pre-wrap', lineHeight: 1.2,
                            }}>{item.label}</span>
                          </button>
                        ))}

                        {/* SMS button in grid */}
                        <button
                          onClick={() => { setShowSmsInModal(s => !s); setSmsStatus('idle'); setSmsMessage(''); setSmsPhone(patientTel); }}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                          }}
                        >
                          <div style={{
                            width: 48, height: 48, borderRadius: '12px',
                            background: showSmsInModal ? '#0284c7' : '#0ea5e9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'background 0.2s',
                          }}>
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H6l-2 2V4h16v10z" /></svg>
                          </div>
                          <span style={{
                            fontSize: '0.68rem', color: showSmsInModal ? '#0284c7' : '#475569',
                            fontWeight: showSmsInModal ? '700' : '500',
                            textAlign: 'center', lineHeight: 1.2,
                          }}>SMS</span>
                        </button>
                      </div>

                      {/* Inline SMS panel — expands inside share modal */}
                      {showSmsInModal && (
                        <div style={{
                          marginTop: '14px', background: '#f0f9ff',
                          border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '14px',
                          display: 'flex', flexDirection: 'column', gap: '10px',
                        }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0369a1' }}>
                            📱 Send via SMS
                          </div>
                          <input
                            type="tel"
                            value={smsPhone}
                            onChange={e => setSmsPhone(e.target.value)}
                            placeholder="e.g. 0771234567"
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: '8px',
                              border: '1.5px solid #38bdf8', background: '#ffffff',
                              fontSize: '0.9rem', color: '#1e293b', fontFamily: 'inherit',
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                          {smsMessage && (
                            <div style={{
                              fontSize: '0.75rem', padding: '6px 10px', borderRadius: '7px',
                              background: smsStatus === 'sent' ? '#dcfce7' : smsStatus === 'error' ? '#fee2e2' : '#e0f2fe',
                              color: smsStatus === 'sent' ? '#15803d' : smsStatus === 'error' ? '#dc2626' : '#0284c7',
                              fontWeight: '600',
                            }}>{smsMessage}</div>
                          )}
                          <button
                            onClick={handleSendViaSms}
                            disabled={smsStatus === 'generating' || smsStatus === 'sending' || smsStatus === 'sent'}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                              padding: '9px 14px', borderRadius: '8px', border: 'none',
                              cursor: (smsStatus === 'generating' || smsStatus === 'sending' || smsStatus === 'sent') ? 'not-allowed' : 'pointer',
                              background: smsStatus === 'sent' ? '#10b981' : '#0284c7',
                              color: '#ffffff', fontWeight: '700', fontSize: '0.88rem',
                              transition: 'background 0.2s',
                              opacity: (smsStatus === 'generating' || smsStatus === 'sending') ? 0.75 : 1,
                            }}
                          >
                            <MessageSquare size={15} />
                            {smsStatus === 'generating' ? 'Generating link...'
                              : smsStatus === 'sending' ? 'Sending SMS...'
                                : smsStatus === 'sent' ? '✓ Sent!'
                                  : 'Send SMS'}
                          </button>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center' }}>
                            The document link (valid 48 hrs) will be sent to this number
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email to myself */}
                    <div style={{ padding: '14px 20px 20px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '12px' }}>
                        Email to myself
                      </div>
                      <button
                        onClick={() => window.open(`mailto:?subject=${encodeURIComponent('My Medical Document')}&body=${encodeURIComponent('My document link: ' + sharePopup.url)}`, '_self')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: '#f8fafc', border: '1.5px dashed #cbd5e1',
                          borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', width: '100%',
                          color: '#475569', fontSize: '0.85rem', fontWeight: '500',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '8px', border: '1.5px dashed #94a3b8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0,
                        }}>
                          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
                        </div>
                        Add email address
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL — 6 Document Type Cards Grid */}
          <div style={{ padding: '28px 36px', overflowY: 'auto', background: '#ffffff' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '22px',
            }}>
              {DOC_TYPES.map(doc => {
                const isSelected = selectedDoc === doc.id;
                const IconComp = doc.icon;
                return (
                  <div
                    key={doc.id}
                    className={`pdm-doc-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedDoc(doc.id)}
                  >
                    {/* Top Right Selected Check Badge */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        width: 24,
                        height: 24,
                        background: '#0090b8',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0, 144, 184, 0.4)',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}

                    {/* Card Title */}
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      marginBottom: '8px',
                      lineHeight: 1.25,
                      paddingRight: isSelected ? '28px' : '0',
                    }}>
                      {doc.title}
                    </div>

                    {/* Card Description */}
                    <div style={{
                      fontSize: '0.86rem',
                      color: '#64748b',
                      lineHeight: 1.55,
                      marginBottom: '20px',
                      flex: 1,
                    }}>
                      {doc.description}
                    </div>

                    {/* Large Card Graphic / Icon */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '16px 0',
                    }}>
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '18px',
                        background: isSelected ? '#f0f9ff' : '#f8fafc',
                        border: isSelected ? '1.5px solid #bae6fd' : '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}>
                        <IconComp size={46} strokeWidth={1.3} style={{ color: doc.iconColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Template Info Strip */}
            <div style={{
              marginTop: '24px',
              padding: '12px 18px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: 32,
                height: 32,
                background: '#e0f2fe',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FileText size={16} color="#0284c7" />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0369a1' }}>
                  Template: {config.clinicName || 'Default Clinic'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  {config.doctorName} &middot; {config.doctorQualifications} &middot; {config.doctorRegNo}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
