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

  /* ── Dynamic left panel per doc type ── */
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

            {/* Action Buttons: Print + Send via SMS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '16px' }}>
              <button className="pdm-print-btn" onClick={handlePrint}>
                Print <Printer size={17} style={{ marginLeft: 4 }} />
              </button>
              <button className="pdm-sms-btn">
                Send via SMS <MessageSquare size={16} style={{ marginLeft: 4 }} />
              </button>
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
