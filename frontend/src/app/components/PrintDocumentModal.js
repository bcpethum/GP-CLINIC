'use client';

import React, { useState } from 'react';
import { X, Printer, MessageSquare, FileText, Pill, DollarSign, BarChart2, Send, ClipboardEdit, User, Calendar, MapPin, ChevronDown } from 'lucide-react';
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
    color: '#eff6ff',
    accent: '#3b82f6',
  },
  {
    id: 'outside_prescription',
    title: 'Outside Prescriptions',
    description: "Involves authorizing medication for patients, typically specifying the medication's name, dosage & instructions.",
    icon: Pill,
    iconColor: '#8b5cf6',
    color: '#f5f3ff',
    accent: '#8b5cf6',
  },
  {
    id: 'medical_bill',
    title: 'Medical Bill',
    description: 'Detailing the cost of medical services provided to patients & payment information.',
    icon: DollarSign,
    iconColor: '#10b981',
    color: '#f0fdf4',
    accent: '#10b981',
  },
  {
    id: 'medical_report',
    title: 'Medical Report',
    description: "Patient's medical history, including diagnoses, treatments, medications, and other relevant information.",
    icon: BarChart2,
    iconColor: '#f59e0b',
    color: '#fffbeb',
    accent: '#f59e0b',
  },
  {
    id: 'referral',
    title: 'Referrals & Other',
    description: 'Medical referrals connect patients to specialists, sharing essential health details for focused care.',
    icon: Send,
    iconColor: '#06b6d4',
    color: '#ecfeff',
    accent: '#06b6d4',
  },
  {
    id: 'custom_document',
    title: 'Custom Document',
    description: 'Type any content and generate a printable or digital document for patient or official use.',
    icon: ClipboardEdit,
    iconColor: '#ec4899',
    color: '#fdf2f8',
    accent: '#ec4899',
  },
];

/* ── Shared input style helper ── */
const inp = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '0.88rem',
  color: '#e2e8f0',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const label = {
  fontSize: '0.72rem',
  color: '#64748b',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '5px',
  display: 'block',
};

const checkRow = (checked, onChange, text) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#94a3b8', userSelect: 'none' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#3b82f6' }}
    />
    {text}
  </label>
);

const PAGE_SIZES = ['A4', 'A5', 'Letter'];
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
        <div style={{ ...label }}>Patient</div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.95rem',
          color: '#e2e8f0',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <User size={14} color="#64748b" />
          {patientName || 'Walk-in Patient'}
        </div>
      </div>
    );

    const PageSizeRow = (
      <div>
        <div style={{ ...label }}>Page Size</div>
        <div style={{ position: 'relative' }}>
          <select
            value={pageSize}
            onChange={e => setPageSize(e.target.value)}
            style={{ ...inp, appearance: 'none', paddingRight: '32px', cursor: 'pointer' }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
        </div>
      </div>
    );

    const HeaderFooterRow = (
      <div>
        <div style={{ ...label }}>Remove Header / Footer</div>
        <div style={{ display: 'flex', gap: '18px' }}>
          {checkRow(removeHeader, setRemoveHeader, 'Header')}
          {checkRow(removeFooter, setRemoveFooter, 'Footer')}
        </div>
      </div>
    );

    const RemarksField = (placeholder = 'Remarks / Next Visit plans / Others') => (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...label }}>{placeholder}</div>
        <textarea
          className="pdm-textarea"
          rows={6}
          placeholder={placeholder + '...'}
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
    );

    if (selectedDoc === 'medical_certificate') {
      return (
        <>
          {PatientDisplay}

          {/* Residence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ ...label }}>Residence</div>
              <div style={{ position: 'relative' }}>
                <select value={residenceType} onChange={e => setResidenceType(e.target.value)}
                  style={{ ...inp, appearance: 'none', paddingRight: '28px', cursor: 'pointer' }}>
                  {RESIDENCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <div style={{ ...label }}>Place</div>
              <input type="text" placeholder="Place" value={residencePlace}
                onChange={e => setResidencePlace(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Consultation Date */}
          <div>
            <div style={{ ...label }}>Consultation Date</div>
            <div style={{ position: 'relative' }}>
              <input type="date" value={consultDate} onChange={e => setConsultDate(e.target.value)} style={inp} />
            </div>
          </div>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ ...label }}>From</div>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} />
            </div>
            <div>
              <div style={{ ...label }}>To</div>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Signs & Symptoms */}
          <div>
            <div style={{ ...label }}>Signs and Symptoms</div>
            <input type="text" placeholder="Signs and Symptoms" value={signsSymptoms}
              onChange={e => setSignsSymptoms(e.target.value)} style={inp} />
          </div>

          {/* Diagnosis display */}
          {diagnosis && (
            <div>
              <div style={{ ...label }}>Diagnosis</div>
              <div style={{ ...inp, color: '#94a3b8' }}>{diagnosis}</div>
            </div>
          )}

          {PageSizeRow}
          {HeaderFooterRow}
          {RemarksField('Remarks / Next Visit plans / Others')}
        </>
      );
    }

    if (selectedDoc === 'outside_prescription') {
      return (
        <>
          {PatientDisplay}

          {diagnosis && (
            <div>
              <div style={{ ...label }}>Diagnosis</div>
              <div style={{ ...inp, color: '#94a3b8' }}>{diagnosis}</div>
            </div>
          )}

          {/* Prescription type */}
          <div>
            <div style={{ ...label }}>Prescription</div>
            <div style={{ display: 'flex', gap: '18px' }}>
              {checkRow(rxInside, setRxInside, 'Inside')}
              {checkRow(rxOutside, setRxOutside, 'Outside')}
            </div>
          </div>

          {PageSizeRow}
          {HeaderFooterRow}
          {checkRow(includeNextVisit, setIncludeNextVisit, 'Include Next Visit Date')}
          {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History')}
          {RemarksField('Remarks / Next Visit plans / Others')}
        </>
      );
    }

    if (selectedDoc === 'medical_bill') {
      return (
        <>
          {PatientDisplay}

          {diagnosis && (
            <div>
              <div style={{ ...label }}>Diagnosis</div>
              <div style={{ ...inp, color: '#94a3b8' }}>{diagnosis}</div>
            </div>
          )}

          {PageSizeRow}
          {HeaderFooterRow}
          {checkRow(detailedBill, setDetailedBill, 'Enable Detailed Bill')}
          {checkRow(includeNextVisit, setIncludeNextVisit, 'Include Next Visit Date')}
          {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History')}
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
          {checkRow(includePastHistory, setIncludePastHistory, 'Include Past Medical History')}
          {RemarksField('Remarks / Next Visit plans / Others')}
        </>
      );
    }

    if (selectedDoc === 'referral') {
      return (
        <>
          {PatientDisplay}

          {/* Quick select */}
          <div>
            <div style={{ ...label }}>Quick Select</div>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...label }}>Notes / Referral Details</div>
            <textarea
              className="pdm-textarea"
              rows={8}
              placeholder="Referral reason, specialist, notes..."
              value={referralNote}
              onChange={e => setReferralNote(e.target.value)}
              style={{ flex: 1 }}
            />
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

          {/* Custom content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...label }}>Document Content</div>
            <textarea
              className="pdm-textarea"
              rows={10}
              placeholder="Type your custom document here..."
              value={customContent}
              onChange={e => setCustomContent(e.target.value)}
              style={{ flex: 1 }}
            />
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
        background: 'rgba(0,0,0,0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: '0',
      }}
    >
      <style>{`
        @keyframes pdmFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .pdm-wrap { animation: pdmFadeIn 0.18s ease-out; }
        .pdm-doc-card { transition: all 0.18s ease; cursor: pointer; }
        .pdm-doc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
        .pdm-quick-btn { transition: all 0.15s ease; cursor: pointer; border: 1.5px solid rgba(99,179,237,0.3); background: rgba(99,179,237,0.06); color: #90cdf4; padding: 5px 11px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
        .pdm-quick-btn:hover { background: rgba(99,179,237,0.18); border-color: #63b3ed; color: #fff; }
        .pdm-quick-btn.active { background: rgba(99,179,237,0.22); border-color: #63b3ed; color: #fff; }
        .pdm-textarea { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; color: #e2e8f0; resize: vertical; font-family: inherit; outline: none; box-sizing: border-box; }
        .pdm-textarea:focus { border-color: rgba(59,130,246,0.4); }
        .pdm-print-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 12px; color: #fff; padding: 16px; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.18s; box-shadow: 0 4px 12px rgba(59,130,246,0.35); width: 100%; }
        .pdm-print-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59,130,246,0.45); }
        .pdm-sms-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #94a3b8; padding: 14px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.18s; width: 100%; }
        .pdm-sms-btn:hover { background: rgba(255,255,255,0.09); color: #e2e8f0; }
        .pdm-close-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #94a3b8; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .pdm-close-btn:hover { background: rgba(239,68,68,0.15); color: #f87171; }
        input[type="date"].pdm-date, select.pdm-select { color-scheme: dark; }
      `}</style>

      <div className="pdm-wrap" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: 'none',
        borderRadius: '0',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Printer size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9' }}>
                Print Your Document
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                Select a document type — the options will update on the left
              </p>
            </div>
          </div>
          <button className="pdm-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          flex: 1,
          overflow: 'hidden',
        }}>

          {/* LEFT PANEL — dynamic per doc type */}
          <div style={{
            borderRight: '1px solid rgba(255,255,255,0.07)',
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.15)',
          }}>
            {renderLeftPanel()}

            {/* Action Buttons — always at bottom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
              <button className="pdm-print-btn" onClick={handlePrint}>
                <Printer size={18} /> Print
              </button>
              <button className="pdm-sms-btn">
                <MessageSquare size={16} /> Send via SMS
              </button>
            </div>
          </div>

          {/* RIGHT PANEL — Document Type Grid */}
          <div style={{ padding: '28px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
              Choose Document Type
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '18px',
            }}>
              {DOC_TYPES.map(doc => {
                const isSelected = selectedDoc === doc.id;
                const IconComp = doc.icon;
                return (
                  <div
                    key={doc.id}
                    className="pdm-doc-card"
                    onClick={() => setSelectedDoc(doc.id)}
                    style={{
                      background: isSelected ? doc.color : 'rgba(255,255,255,0.03)',
                      border: isSelected
                        ? `2px solid ${doc.accent}`
                        : '1.5px solid rgba(255,255,255,0.07)',
                      borderRadius: '18px',
                      padding: '26px',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 12, right: 12,
                        width: 26, height: 26,
                        background: doc.accent,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}

                    <div style={{ marginBottom: '14px', opacity: isSelected ? 1 : 0.55 }}>
                      <IconComp size={62} strokeWidth={1.1} style={{ color: doc.iconColor }} />
                    </div>

                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: isSelected ? '#0f172a' : '#e2e8f0',
                      marginBottom: '8px',
                      lineHeight: 1.2,
                    }}>
                      {doc.title}
                    </div>

                    <div style={{
                      fontSize: '0.85rem',
                      color: isSelected ? '#475569' : '#64748b',
                      lineHeight: 1.55,
                    }}>
                      {doc.description}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Template Info Strip */}
            <div style={{
              marginTop: '20px',
              padding: '14px 18px',
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.14)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: 32, height: 32,
                background: 'rgba(59,130,246,0.14)',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FileText size={15} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd' }}>
                  Template: {config.clinicName || 'Default Clinic'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569' }}>
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
