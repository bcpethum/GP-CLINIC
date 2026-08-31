'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Plus, Trash2, Printer, Check, RefreshCw, QrCode, Camera, Calendar, FileText, ExternalLink, Copy, X, ArrowRight } from 'lucide-react';
import QrCanvas from './QrCanvas';
import PrintDocumentModal from './PrintDocumentModal';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getSavedPrescriptionConfig, buildPrescriptionHtml, formatPatientAge } from '../lib/prescriptionConfig';

const VISIT_CATEGORIES = [
  'Normal',
  'Clinical',
  'Osteoarthritis',
  'Paediatric < 1yr',
  'Paediatric < 5yr',
  'Paediatric < 12yr',
  'Obstetrics',
  'Gynaecology',
  'Diabetes',
  'HT',
  'CKD',
  'Dyslipidaemia',
  'Asthma',
  'COPD',
  'IHD',
  'Depoprovera',
  'Psychiatric conditions',
  'Home visit',
  'Palliative care',
  'NCD clinic',
  'Nutrition clinic',
  'OPD',
  'ENT',
  'EYE',
  'Dermatology',
  'Skin',
  'GORD'
];

const DOSE_QUANTITIES = [
  '1/4',
  '1/3',
  '1/2',
  '2/3',
  '3/4',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '4',
  '5',
  '6'
];

const DOSE_FREQUENCIES = [
  'M',
  'N',
  'BD',
  'TDS',
  'QDS',
  'SOS',
  'EOD',
  'STAT',
  'VESP',
  'NOON',
  '2H',
  '4H',
  '6H',
  '8H',
  'WEEKLY'
];

const parseDoseQtyValue = (qtyStr) => {
  if (!qtyStr) return 1;
  if (qtyStr.includes('/')) {
    const [num, den] = qtyStr.split('/');
    const n = parseFloat(num) || 1;
    const d = parseFloat(den) || 1;
    return n / d;
  }
  return parseFloat(qtyStr) || 1;
};

const getDoseFrequencyMultiplier = (freqStr) => {
  switch ((freqStr || '').toUpperCase()) {
    case 'M':
    case 'N':
    case 'VESP':
    case 'NOON':
    case 'SOS':
      return 1;
    case 'STAT':
      return 1;
    case 'BD':
      return 2;
    case 'TDS':
    case '8H':
      return 3;
    case 'QDS':
    case '6H':
      return 4;
    case '4H':
      return 6;
    case '2H':
      return 12;
    case 'EOD':
      return 0.5;
    case 'WEEKLY':
      return 1 / 7;
    default:
      return 1;
  }
};

export default function DoctorTab({ API_BASE, prescriptionDesign, clinicName, clinicPhone, clinicAddress, showAlert, showConfirm }) {
  const { user } = useAuth();
  // Live statistics (Top Right)
  const [dailyStats, setDailyStats] = useState({ count: 0, total: 0 });

  // Print document modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Patients in queue
  const [queue, setQueue] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null); // The visit currently open

  // Demographics Search & Edit States
  const [searchTel, setSearchTel] = useState('');
  const [searchName, setSearchName] = useState('');
  const [ageY, setAgeY] = useState('');
  const [ageM, setAgeM] = useState('0');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  // QR code text state
  const [qrCodeData, setQrCodeData] = useState('');

  // Date and Priority
  const [visitDateText, setVisitDateText] = useState(new Date().toISOString().split('T')[0]);
  const [visitPriority, setVisitPriority] = useState('Normal');

  // Selected history visit ID (to display in dropdown)
  const [historyVisitId, setHistoryVisitId] = useState('');

  // Diagnosis & Plan
  const [diagnosis, setDiagnosis] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [nextVisitPlan, setNextVisitPlan] = useState('');

  // Dropdown toggles
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  const [showLastVisitDropdown, setShowLastVisitDropdown] = useState(false);
  const [showLabsDropdown, setShowLabsDropdown] = useState(false);
  const [showNextVisitDropdown, setShowNextVisitDropdown] = useState(false);

  // All Visits modal & expanded visit card state
  const [showAllVisitsModal, setShowAllVisitsModal] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const [modalExpandedVisitId, setModalExpandedVisitId] = useState(null);

  // History of active patient
  const [history, setHistory] = useState([]);

  // Lab Investigations inputs for this visit
  const [fbc, setFbc] = useState('');
  const [fbs, setFbs] = useState('');
  const [lipidProfile, setLipidProfile] = useState('');
  const [ufr, setUfr] = useState('');
  const [crp, setCrp] = useState('');
  const [esr, setEsr] = useState('');
  const [dengueNs1, setDengueNs1] = useState('');
  const [influenzaAg, setInfluenzaAg] = useState('');
  const [lft, setLft] = useState('');
  const [tft, setTft] = useState('');
  const [rft, setRft] = useState('');

  // Prescription builder state
  const [prescribedDrugs, setPrescribedDrugs] = useState([]);

  // Medicine Inventory Lookup search
  const [drugSearch, setDrugSearch] = useState('');
  const [drugSearchResults, setDrugSearchResults] = useState([]);

  // Form input drug details
  const [inputMedName, setInputMedName] = useState('');
  const [inputDoseQty, setInputDoseQty] = useState('1');
  const [inputDoseFreq, setInputDoseFreq] = useState('TDS');
  const [inputDuration, setInputDuration] = useState('3');
  const [inputPrice, setInputPrice] = useState('0');
  const [selectedDrugId, setSelectedDrugId] = useState(null);

  // Billing
  const [consultationFee, setConsultationFee] = useState('500');
  const [isFoc, setIsFoc] = useState(false);

  // Fetch queue and statistics on mount
  useEffect(() => {
    fetchQueue();
    fetchStats();
  }, []);

  // Fetch history when selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      fetchPatientHistory(selectedPatient.id);
    } else {
      setHistory([]);
      clearActiveForm();
    }
  }, [selectedPatient]);

  const fetchQueue = async () => {
    try {
      const data = await apiFetch('/queue');
      console.log("Queue loaded:", data);
      setQueue(data);
    } catch (err) {
      console.error("Queue fetch error:", err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/queue/stats');
      setDailyStats({ count: data.patient_count, total: data.daily_income });
    } catch (err) {
      console.error(err.message);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    try {
      const data = await apiFetch(`/patients/${patientId}/history`);
      setHistory(data);
      const lastCompletedVisit = data.find(v => v.status === 'Completed');
      if (lastCompletedVisit && lastCompletedVisit.investigation) {
        const inv = lastCompletedVisit.investigation;
        setFbc(inv.fbc || ''); setFbs(inv.fbs || ''); setLipidProfile(inv.lipid_profile || '');
        setUfr(inv.ufr || ''); setCrp(inv.crp || ''); setEsr(inv.esr || '');
        setDengueNs1(inv.dengue_ns1 || ''); setInfluenzaAg(inv.influenza_ag || '');
        setLft(inv.lft || ''); setTft(inv.tft || ''); setRft(inv.rft || '');
      } else {
        clearLabsForm();
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  // Load a patient details into form
  const loadPatientIntoForm = (patient, currentQueue = queue) => {
    console.log("Loading patient into form:", patient);
    setSelectedPatient(patient);
    setSearchName(patient.name);
    setSearchTel(patient.telephone);
    setAgeY(patient.age ? patient.age.toString() : '');
    setAgeM('0');
    setWeight(patient.weight ? patient.weight.toString() : '');
    setHeight(patient.height ? patient.height.toString() : '');
    setAllergiesText(patient.allergies || '');

    // Check if this patient already has a Pending/Active queue visit today (type-safe comparison against newest queue)
    const activeQueueVisit = currentQueue.find(q => Number(q.patient_id) === Number(patient.id));
    if (activeQueueVisit) {
      console.log("Active queue visit found:", activeQueueVisit);
      setActiveVisit(activeQueueVisit);
    } else {
      console.log("No active queue visit. Creating mock active consult.");
      // Create a mock active session
      setActiveVisit({
        patient_id: patient.id,
        name: patient.name,
        telephone: patient.telephone,
        age: patient.age,
        weight: patient.weight,
        height: patient.height,
        allergies: patient.allergies,
        status: 'Active',
        id: null // Needs queue register on confirm
      });
    }

    setHistoryVisitId('');

    // Auto-generate QR code mapping
    const dataString = `patient:${patient.id}:${patient.name}:${patient.telephone}`;
    setQrCodeData(dataString);
  };

  const handleSelectActiveVisit = async (visit, currentQueue = queue) => {
    console.log("Selected active queue visit:", visit);
    // 1. Fetch full patient profile to capture allergies, weight, height
    try {
      const patient = await apiFetch(`/patients/${visit.patient_id}`);
      loadPatientIntoForm(patient, currentQueue);
    } catch (err) {
      console.error(err);
      await showAlert("Error fetching patient details: " + err.message, "Connection Error");
    }

    // 2. Set visit status to active
    try {
      await apiFetch(`/queue/${visit.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Active' })
      });
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  // Magnifying Search by Tel No
  const handleSearchByTel = async () => {
    if (!searchTel.trim()) return;
    try {
      const data = await apiFetch(`/patients?search=${encodeURIComponent(searchTel)}`);
      if (data.length > 0) {
        loadPatientIntoForm(data[0]);
      } else {
        await showAlert('No registered patient found with this Tel No. You can enter details manually to record a new visit.', 'Not Found');
        setSelectedPatient(null);
        setActiveVisit(null);
      }
    } catch (err) {
      console.error(err);
      await showAlert("Connection error searching telephone: " + err.message, "Connection Error");
    }
  };

  // Magnifying Search by Name
  const handleSearchByName = async () => {
    if (!searchName.trim()) return;
    try {
      const data = await apiFetch(`/patients?search=${encodeURIComponent(searchName)}`);
      if (data.length > 0) {
        loadPatientIntoForm(data[0]);
      } else {
        await showAlert('No registered patient found with this Name. You can enter details manually to record a new visit.', 'Not Found');
        setSelectedPatient(null);
        setActiveVisit(null);
      }
    } catch (err) {
      console.error(err);
      await showAlert("Connection error searching name: " + err.message, "Connection Error");
    }
  };

  // QR Code Generation Action
  const handleGenerateQrCode = async () => {
    if (!searchName || !searchTel) {
      await showAlert('Please fill Name and Telephone number first.', 'Input Missing');
      return;
    }
    const dataString = `patient:${selectedPatient?.id || 'new'}:${searchName}:${searchTel}`;
    setQrCodeData(dataString);
    await showAlert('QR code generated successfully!', 'Success');
  };

  // QR Code Scanner Mock Simulator
  const handleScanQrMock = async () => {
    const scanData = prompt(
      "Scan QR Code Simulator:\n\nEnter QR Code text (e.g. patient:1:Chamidu Pethum:0718464482) or scan check-in data:"
    );
    if (!scanData) return;

    if (scanData.startsWith('patient:')) {
      const parts = scanData.split(':');
      const id = parseInt(parts[1]);

      if (id && !isNaN(id) && id > 0) {
        try {
          const patient = await apiFetch(`/patients/${id}`);
          loadPatientIntoForm(patient);
          await showAlert(`Patient loaded: ${patient.name}`, 'Check-in Success');
        } catch (err) {
          await showAlert('Patient ID from QR scan not found.', 'Not Found');
        }
      } else {
        setSearchName(parts[2] || '');
        setSearchTel(parts[3] || '');
        setAgeY('30');
        setAgeM('0');
        setSelectedPatient(null);
        setActiveVisit(null);
        await showAlert('Walk-in details parsed. Ready to register!', 'Walk-in Parsed');
      }
    } else {
      await showAlert('Invalid QR Code format. Use "patient:ID:Name:Tel" to simulate a valid scan.', 'Scan Error');
    }
  };

  const handleDrugSearch = async (query) => {
    setDrugSearch(query);
    if (!query.trim()) {
      setDrugSearchResults([]);
      return;
    }
    try {
      const data = await apiFetch(`/drugs?search=${encodeURIComponent(query)}`);
      setDrugSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectDrugFromLookup = (drug) => {
    setInputMedName(drug.name);
    setInputPrice(drug.selling_price.toString());
    setSelectedDrugId(drug.id);
    setDrugSearchResults([]);
    setDrugSearch('');
  };

  const addPrescribedDrug = () => {
    if (!inputMedName.trim()) return;

    const count = parseInt(inputDuration) || 1;
    const pricePerUnit = parseFloat(inputPrice) || 0;

    const qtyVal = parseDoseQtyValue(inputDoseQty);
    const freqMult = getDoseFrequencyMultiplier(inputDoseFreq);

    // Calculate total price based on dosage quantity, frequency, and duration
    const totalUnits = inputDoseFreq === 'STAT' ? Math.ceil(qtyVal) : Math.ceil(qtyVal * freqMult * count);
    const totalItemPrice = totalUnits * pricePerUnit;

    const combinedDosage = `${inputDoseQty} ${inputDoseFreq}`;

    const newDrug = {
      drug_id: selectedDrugId,
      medicine_name: inputMedName,
      dosage: combinedDosage,
      duration_days: parseInt(inputDuration) || 1,
      price: totalItemPrice
    };

    setPrescribedDrugs([...prescribedDrugs, newDrug]);

    // Clear inputs
    setInputMedName('');
    setInputPrice('0');
    setSelectedDrugId(null);
  };

  const removePrescribedDrug = (index) => {
    setPrescribedDrugs(prescribedDrugs.filter((_, i) => i !== index));
  };

  const drugCostTotal = prescribedDrugs.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  const effectiveConsultFee = isFoc ? 0 : (parseFloat(consultationFee) || 0);
  const totalBill = effectiveConsultFee + drugCostTotal;

  const clearLabsForm = () => {
    setFbc(''); setFbs(''); setLipidProfile(''); setUfr(''); setCrp(''); setEsr('');
    setDengueNs1(''); setInfluenzaAg(''); setLft(''); setTft(''); setRft('');
  };

  const handleClearForm = () => {
    setSelectedPatient(null);
    setActiveVisit(null);
    setSearchTel('');
    setSearchName('');
    setAgeY('');
    setAgeM('0');
    setWeight('');
    setHeight('');
    setAllergiesText('');
    setQrCodeData('');
    setHistoryVisitId('');
    setVisitPriority('Normal');
    clearActiveForm();
  };

  const clearActiveForm = () => {
    setDiagnosis('');
    setNextVisitDate('');
    setNextVisitPlan('');
    setPrescribedDrugs([]);
    clearLabsForm();
  };

  // Complete / Register & Complete Visit Logic
  const handleConfirmAndSend = async () => {
    if (!searchName || !searchTel) {
      await showAlert('Please select or fill out Name and Telephone number first.', 'Validation Error');
      return;
    }

    try {
      let patientIdToUse = selectedPatient?.id;
      let visitIdToUse = activeVisit?.id;

      // 1. If patient doesn't exist yet, register them on the fly
      if (!selectedPatient) {
        const calculatedAge = (parseInt(ageY) || 0) + (parseInt(ageM) || 0) / 12;
        const newPatient = await apiFetch('/patients', {
          method: 'POST',
          body: JSON.stringify({
            name: searchName, telephone: searchTel,
            age: Math.ceil(calculatedAge) || 30,
            weight: weight ? parseFloat(weight) : null,
            height: height ? parseFloat(height) : null,
            allergies: allergiesText
          })
        });
        patientIdToUse = newPatient.id;
        setSelectedPatient(newPatient);
      }

      // 2. If no active visit today exists, register a new visit row in database
      if (!visitIdToUse) {
        const newVisit = await apiFetch('/queue', {
          method: 'POST',
          body: JSON.stringify({ patient_id: patientIdToUse, date: visitDateText })
        });
        visitIdToUse = newVisit.id;
      }

      // 3. Complete the visit by submitting diagnostics
      const payload = {
        diagnosis,
        next_visit_date: nextVisitDate || null,
        next_visit_plan: nextVisitPlan,
        total_fee: totalBill,
        paid_amount: totalBill,
        is_foc: isFoc,
        prescriptions: prescribedDrugs,
        investigations: {
          fbc, fbs, lipid_profile: lipidProfile, ufr, crp, esr,
          dengue_ns1: dengueNs1, influenza_ag: influenzaAg, lft, tft, rft
        }
      };

      await apiFetch(`/queue/${visitIdToUse}/diagnose`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      await showAlert('Patient visit completed successfully!', 'Consultation Finalized');
      fetchQueue();
      fetchStats();
      if (patientIdToUse) fetchPatientHistory(patientIdToUse);

    } catch (err) {
      console.error(err);
      await showAlert(err.message || 'Network error finalizing consult visit', 'Finalize Error');
    }
  };

  const handlePrintPrescription = () => {
    // Open the print document selection modal
    setShowPrintModal(true);
  };

  // Print a historical visit's prescription directly
  const handlePrintHistoryVisit = (visit) => {
    const config = getSavedPrescriptionConfig(user?.id);
    const ageText = formatPatientAge(ageY, ageM);
    const visitDate = visit.visit_date ? new Date(visit.visit_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const html = buildPrescriptionHtml({
      config,
      patientName: searchName || selectedPatient?.name || 'Patient',
      ageText,
      allergies: allergiesText,
      visitDate,
      queueNumber: visit.id,
      prescriptions: visit.prescriptions || [],
      planOfAction: visit.next_visit_plan || ''
    });
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // Load a historical visit's prescription into the current form
  const handleRepeatPrescription = (visit) => {
    if (visit.prescriptions && visit.prescriptions.length > 0) {
      setPrescribedDrugs(visit.prescriptions.map(p => ({
        drug_id: p.drug_id || null,
        medicine_name: p.medicine_name,
        dosage: p.dosage,
        duration_days: p.duration_days,
        price: parseFloat(p.price) || 0
      })));
      if (visit.diagnosis) setDiagnosis(visit.diagnosis);
      showAlert(`Loaded ${visit.prescriptions.length} medicine(s) from visit on ${new Date(visit.visit_date).toLocaleDateString()}`, 'Prescription Repeated');
    } else {
      showAlert('No prescriptions found in this visit.', 'Nothing to Load');
    }
  };

  return (
    <>
      <div className="doctor-panel-wrapper fade-in">

        {/* Top Banner Stats Widget – stays pinned, never scrolls */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,100,200,0.05)',
          border: '1px solid rgba(0,100,200,0.12)',
          borderRadius: '12px',
          padding: '12px 24px'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Doctor Panel</h3>
            <span style={{
              fontSize: '0.8rem',
              background: 'var(--accent-blue-bg)',
              color: 'var(--color-secondary)',
              padding: '3px 10px',
              borderRadius: '12px'
            }}>Active Queue: {queue.length} Patients</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              background: 'rgba(0,100,200,0.05)',
              padding: '6px 16px',
              borderRadius: '30px',
              border: '1px solid rgba(0,100,200,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Count: <strong style={{ color: 'var(--text-primary)' }}>{dailyStats.count}</strong>
              </span>
              <span style={{ color: 'rgba(0,100,200,0.2)' }}>|</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Total: <strong style={{ color: 'var(--color-primary)' }}>{dailyStats.total} LKR</strong>
              </span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => { fetchQueue(); fetchStats(); }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Two-column content area: left + right independently scrollable */}
        <main className="doctor-content">

          {/* LEFT COLUMN: Patient / Demographics / Clinical scroll container */}
          <section className="left-scroll-container">

          {/* Dropdowns Block */}
          <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '14px' }}>
            <div>
              <label className="label-glass" style={{ fontSize: '0.85rem' }}>Select from queue</label>
              <select
                className="input-glass"
                value={activeVisit?.id ? activeVisit.id.toString() : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleClearForm();
                    return;
                  }
                  const visit = queue.find(q => Number(q.id) === Number(val));
                  if (visit) handleSelectActiveVisit(visit);
                }}
                style={{ fontSize: '0.95rem', padding: '9px 10px' }}
              >
                <option value="">-</option>
                {queue.map(q => (
                  <option key={q.id} value={q.id.toString()}>Q#{q.queue_number} - {q.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-glass" style={{ fontSize: '0.85rem' }}>Previous visits</label>
              <select
                className="input-glass"
                value={historyVisitId ? historyVisitId.toString() : ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  setHistoryVisitId(val);
                  if (!val) return;
                  const visit = history.find(h => Number(h.id) === Number(val));
                  if (visit) {
                    setDiagnosis(visit.diagnosis || '');
                    setNextVisitPlan(visit.next_visit_plan || '');
                    if (visit.prescriptions) {
                      setPrescribedDrugs(visit.prescriptions.map(p => ({
                        medicine_name: p.medicine_name,
                        dosage: p.dosage,
                        duration_days: p.duration_days,
                        price: parseFloat(p.price)
                      })));
                    }
                    await showAlert(`Loaded details of visit from ${new Date(visit.visit_date).toLocaleDateString()}`, 'History Loaded');
                  }
                }}
                style={{ fontSize: '0.95rem', padding: '9px 10px' }}
                disabled={history.length === 0}
              >
                <option value="">-</option>
                {history.map(h => (
                  <option key={h.id} value={h.id.toString()}>{new Date(h.visit_date).toLocaleDateString()} - {h.diagnosis || 'Checkup'}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Demographics, Search & QR panel (Image 2 exact match) */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.8fr', gap: '14px' }}>
              {/* Left Inputs block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="label-glass" style={{ fontSize: '0.9rem' }}>Tel No</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Search phone..."
                      value={searchTel}
                      onChange={(e) => setSearchTel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchByTel()}
                      style={{ fontSize: '1rem', padding: '10px 12px' }}
                    />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleSearchByTel}>
                      <Search size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label-glass" style={{ fontSize: '0.9rem' }}>Name</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Search name..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchByName()}
                      style={{ fontSize: '1rem', padding: '10px 12px' }}
                    />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleSearchByName}>
                      <Search size={16} />
                    </button>
                  </div>
                </div>

                {/* Age & Vitals block */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 44px', gap: '8px' }}>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.9rem' }}>Y</label>
                    <input
                      type="number"
                      className="input-glass"
                      placeholder="Years"
                      value={ageY}
                      onChange={(e) => setAgeY(e.target.value)}
                      style={{ textAlign: 'center', padding: '10px 8px', fontSize: '1rem' }}
                    />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.9rem' }}>M</label>
                    <input
                      type="number"
                      className="input-glass"
                      placeholder="Months"
                      value={ageM}
                      onChange={(e) => setAgeM(e.target.value)}
                      style={{ textAlign: 'center', padding: '10px 8px', fontSize: '1rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px', width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => {
                        if (selectedPatient) showAlert(`Loading complete digital card for Patient ID: ${selectedPatient.id}`, 'Digital Patient Card');
                        else showAlert('Please search or load a patient first.', 'No Patient Loaded');
                      }}
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right QR block */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* QR display square */}
                <div style={{
                  width: '148px',
                  height: '148px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.08)'
                }}>
                  <QrCanvas text={qrCodeData} size={140} />
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '148px', padding: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                  onClick={handleGenerateQrCode}
                >
                  Generate
                </button>

                <div style={{ display: 'flex', gap: '4px', width: '148px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={handleScanQrMock}>
                    <QrCode size={15} />
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={async () => await showAlert('Launching camera view interface for live QR code scanning...', 'Live Scanner')}>
                    <Camera size={15} />
                  </button>
                </div>

                <button
                  className="btn btn-warning"
                  style={{ width: '148px', padding: '6px', fontSize: '0.85rem' }}
                  onClick={handleClearForm}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Vitals row (editable weight/height) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <div>
                <label className="label-glass" style={{ fontSize: '0.85rem' }}>Weight (kg)</label>
                <input type="number" className="input-glass" placeholder="Wt" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ padding: '10px 12px', fontSize: '1rem' }} />
              </div>
              <div>
                <label className="label-glass" style={{ fontSize: '0.85rem' }}>Height (cm)</label>
                <input type="number" className="input-glass" placeholder="Ht" value={height} onChange={(e) => setHeight(e.target.value)} style={{ padding: '10px 12px', fontSize: '1rem' }} />
              </div>
            </div>

            {/* Date Picker & Visit priority / Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                <input
                  type="date"
                  className="input-glass"
                  value={visitDateText}
                  onChange={(e) => setVisitDateText(e.target.value)}
                  style={{ fontSize: '0.95rem', padding: '9px 8px' }}
                />
              </div>
              <div>
                <select
                  className="input-glass"
                  value={visitPriority}
                  onChange={(e) => setVisitPriority(e.target.value)}
                  style={{ fontSize: '0.95rem', padding: '9px 10px', width: '100%' }}
                >
                  {VISIT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Pink Allergies Warning block */}
          {allergiesText && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              padding: '12px',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>Allergies Alert Warning:</strong>
              <span>{allergiesText}</span>
            </div>
          )}

          {/* Diagnosis Dropdown */}
          <div className="glass-panel" style={{ padding: '14px 20px' }}>
            <div
              onClick={() => setShowDiagnosisDropdown(!showDiagnosisDropdown)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>Diagnosis & Current Illness</span>
              {showDiagnosisDropdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {showDiagnosisDropdown && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  className="input-glass"
                  rows={3}
                  placeholder="Enter diagnosis, illness description, clinical notes..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  style={{ resize: 'none', fontSize: '1rem', padding: '10px 12px' }}
                />
              </div>
            )}
          </div>

          {/* Last Visit Details Dropdown - Enhanced */}
          <div className="glass-panel" style={{ padding: '14px 20px' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div
                onClick={() => setShowLastVisitDropdown(!showLastVisitDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
              >
                <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>Last Visit Details &amp; History</span>
                {history.length > 0 && (
                  <span style={{
                    fontSize: '0.7rem', background: 'var(--accent-blue-bg)', color: 'var(--color-secondary)',
                    padding: '2px 8px', borderRadius: '10px', fontWeight: '600'
                  }}>{history.length} visit{history.length !== 1 ? 's' : ''}</span>
                )}
                {showLastVisitDropdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {/* All Visits button */}
              <button
                onClick={() => setShowAllVisitsModal(true)}
                disabled={history.length === 0}
                style={{
                  background: 'none', border: '1px solid var(--glass-border)', borderRadius: '6px',
                  padding: '4px 10px', cursor: history.length === 0 ? 'not-allowed' : 'pointer',
                  color: history.length === 0 ? 'var(--text-muted)' : 'var(--color-secondary)',
                  fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px',
                  opacity: history.length === 0 ? 0.5 : 1, transition: 'all 0.2s'
                }}
                title="View all visits"
              >
                <ExternalLink size={13} /> All Visits
              </button>
            </div>

            {showLastVisitDropdown && (
              <div style={{ marginTop: '12px', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
                {history.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px', textAlign: 'center' }}>No previous visit records found.</div>
                ) : (
                  history.map((h, i) => {
                    const isExpanded = expandedVisitId === h.id;
                    const visitDate = new Date(h.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const hasMeds = h.prescriptions && h.prescriptions.length > 0;
                    return (
                      <div key={h.id} style={{
                        background: i === 0 ? 'rgba(0,153,255,0.06)' : 'rgba(0,0,0,0.15)',
                        border: i === 0 ? '1px solid rgba(0,153,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '10px', fontSize: '0.85rem', overflow: 'hidden'
                      }}>
                        {/* Visit card header */}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: i === 0 ? '#10b981' : '#64748b', display: 'inline-block', flexShrink: 0
                              }} />
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{visitDate}</strong>
                              {i === 0 && (
                                <span style={{ fontSize: '0.68rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>LAST VISIT</span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>Rs. {(parseFloat(h.total_fee) || 0).toFixed(0)}</span>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Diagnosis:</strong> {h.diagnosis || 'General Checkup'}
                            </span>
                          </div>

                          {/* Expandable prescription table */}
                          {hasMeds && (
                            <div>
                              <button
                                onClick={() => setExpandedVisitId(isExpanded ? null : h.id)}
                                style={{
                                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                                  display: 'flex', alignItems: 'center', gap: '4px', marginBottom: isExpanded ? '8px' : '0'
                                }}
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {h.prescriptions.length} Medicine(s)
                              </button>

                              {isExpanded && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '4px' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(0,153,255,0.08)', borderBottom: '1px solid rgba(0,153,255,0.15)' }}>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: '600' }}>Drug</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: '600' }}>Dosage</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: '600' }}>Durat..</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {h.prescriptions.map((rx, idx) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '6px 10px', color: 'var(--text-primary)', fontWeight: '500' }}>{rx.medicine_name}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--color-secondary)' }}>{rx.dosage}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{rx.duration_days}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button
                              onClick={() => handlePrintHistoryVisit(h)}
                              style={{
                                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '6px', padding: '6px 8px', cursor: 'pointer',
                                color: 'var(--text-secondary)', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                transition: 'all 0.2s'
                              }}
                              title="Print this prescription"
                            >
                              <Printer size={12} /> Print
                            </button>
                            <button
                              onClick={() => handleRepeatPrescription(h)}
                              disabled={!hasMeds}
                              style={{
                                flex: 2, background: hasMeds ? 'rgba(0,153,255,0.12)' : 'rgba(0,0,0,0.1)',
                                border: `1px solid ${hasMeds ? 'rgba(0,153,255,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                borderRadius: '6px', padding: '6px 10px', cursor: hasMeds ? 'pointer' : 'not-allowed',
                                color: hasMeds ? 'var(--color-secondary)' : 'var(--text-muted)', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                opacity: hasMeds ? 1 : 0.5, transition: 'all 0.2s'
                              }}
                              title="Use this prescription for current visit"
                            >
                              <Copy size={12} /> Use this Prescription
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Laboratory Investigations Panel */}
          <div className="glass-panel" style={{ padding: '14px 20px' }}>
            <div
              onClick={() => setShowLabsDropdown(!showLabsDropdown)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>Lab Investigations Log</span>
              {showLabsDropdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {showLabsDropdown && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Input current values or review previous entries below.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Full Blood Count (FBC)</label>
                    <input type="text" className="input-glass" placeholder="WBC, RBC, Hb" value={fbc} onChange={(e) => setFbc(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Fasting Blood Sugar (FBS)</label>
                    <input type="text" className="input-glass" placeholder="mg/dl" value={fbs} onChange={(e) => setFbs(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Lipid Profile</label>
                    <input type="text" className="input-glass" placeholder="Chol, HDL, LDL" value={lipidProfile} onChange={(e) => setLipidProfile(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Urine Full Report (UFR)</label>
                    <input type="text" className="input-glass" placeholder="Album, Sugar, Pus" value={ufr} onChange={(e) => setUfr(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>C-Reactive Protein (C-RP)</label>
                    <input type="text" className="input-glass" placeholder="mg/L" value={crp} onChange={(e) => setCrp(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>ESR</label>
                    <input type="text" className="input-glass" placeholder="mm/hr" value={esr} onChange={(e) => setEsr(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Dengue NS-1 Ag</label>
                    <input type="text" className="input-glass" placeholder="Neg/Pos" value={dengueNs1} onChange={(e) => setDengueNs1(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Influenza Ag</label>
                    <input type="text" className="input-glass" placeholder="Neg/Pos" value={influenzaAg} onChange={(e) => setInfluenzaAg(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Liver Function (LFT)</label>
                    <input type="text" className="input-glass" placeholder="SGPT, SGOT" value={lft} onChange={(e) => setLft(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Thyroid Function (TFT)</label>
                    <input type="text" className="input-glass" placeholder="TSH, T3, T4" value={tft} onChange={(e) => setTft(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="label-glass" style={{ fontSize: '0.7rem' }}>Renal Function (RFT)</label>
                    <input type="text" className="input-glass" placeholder="Urea, Creatinine" value={rft} onChange={(e) => setRft(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Next Visit Scheduler Dropdown */}
          <div className="glass-panel" style={{ padding: '14px 20px' }}>
            <div
              onClick={() => setShowNextVisitDropdown(!showNextVisitDropdown)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>Next Visit Schedule</span>
              {showNextVisitDropdown ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {showNextVisitDropdown && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="label-glass" style={{ fontSize: '0.9rem' }}>Next Visit Date</label>
                  <input
                    type="date"
                    className="input-glass"
                    value={nextVisitDate}
                    onChange={(e) => setNextVisitDate(e.target.value)}
                    style={{ padding: '10px 12px', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label className="label-glass" style={{ fontSize: '0.9rem' }}>Next Visit Plan</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="e.g. Check Hb levels, review BP"
                    value={nextVisitPlan}
                    onChange={(e) => setNextVisitPlan(e.target.value)}
                    style={{ padding: '10px 12px', fontSize: '0.95rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Patient Queue List (Selectable) */}
          <div className="glass-panel" style={{ flex: 1, minHeight: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Waiting Queue Line</h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click patient to consult</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {queue.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No patients waiting.</p>
              ) : (
                queue.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectActiveVisit(item)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: activeVisit?.id === item.id ? 'rgba(0,153,255,0.1)' : 'rgba(255,255,255,0.02)',
                      border: activeVisit?.id === item.id ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    <span><strong>#{item.queue_number}</strong> - {item.name}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      background: item.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: item.status === 'Active' ? 'var(--color-success)' : 'var(--color-warning)'
                    }}>{item.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          </section>

          {/* RIGHT COLUMN: Prescription Builder & Dispenser scroll container */}
          <section className="right-scroll-container">
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>


            {/* Search Inventory & Autofill Row */}
            <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search inventory drugs..."
                  value={drugSearch}
                  onChange={(e) => handleDrugSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 42px 11px 16px',
                    fontSize: '1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #d1d5db',
                    background: '#ffffff',
                    color: '#111827',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
                  }}
                />
                <Search size={17} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
              </div>

              {/* Drug Search dropdown list */}
              {drugSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }}>
                  {drugSearchResults.map(drug => (
                    <div
                      key={drug.id}
                      onClick={() => selectDrugFromLookup(drug)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '0.88rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#111827',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f3ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <span><strong>{drug.name}</strong> <span style={{ color: '#6b7280', fontWeight: 400 }}>({drug.type})</span></span>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: drug.stock < drug.notify_threshold ? '#ef4444' : '#10b981',
                        background: drug.stock < drug.notify_threshold ? '#fef2f2' : '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}>
                        Stock: {drug.stock} | {drug.selling_price} LKR
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Drug Add row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.6fr 0.9fr 1fr 44px',
              gap: '8px',
              background: 'rgba(0,0,0,0.1)',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)'
            }}>
              <div>
                <label className="label-glass" style={{ fontSize: '0.9rem' }}>Medicine Name</label>
                <input type="text" className="input-glass" placeholder="Amoxil, Panadol" value={inputMedName} onChange={(e) => setInputMedName(e.target.value)} style={{ padding: '10px 12px', fontSize: '1rem' }} />
              </div>
              <div>
                <label className="label-glass" style={{ fontSize: '0.9rem' }}>Dosage</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '4px' }}>
                  <select
                    className="input-glass"
                    value={inputDoseQty}
                    onChange={(e) => setInputDoseQty(e.target.value)}
                    style={{ padding: '10px 4px', fontSize: '0.95rem', textAlign: 'center' }}
                    title="Dose Quantity"
                  >
                    {DOSE_QUANTITIES.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <select
                    className="input-glass"
                    value={inputDoseFreq}
                    onChange={(e) => setInputDoseFreq(e.target.value)}
                    style={{ padding: '10px 4px', fontSize: '0.95rem', textAlign: 'center' }}
                    title="Dose Frequency"
                  >
                    {DOSE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-glass" style={{ fontSize: '0.9rem' }}>Day(s)</label>
                <input type="number" className="input-glass" placeholder="Days" value={inputDuration} onChange={(e) => setInputDuration(e.target.value)} style={{ padding: '10px 12px', fontSize: '1rem' }} />
              </div>
              <div>
                <label className="label-glass" style={{ fontSize: '0.9rem' }}>Price/tab</label>
                <input type="number" className="input-glass" placeholder="Price" value={inputPrice} onChange={(e) => setInputPrice(e.target.value)} style={{ padding: '10px 12px', fontSize: '1rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={addPrescribedDrug} style={{ padding: '10px', width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Add to Prescription">
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Prescribed Items Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)', minHeight: '150px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)' }}>Medicine</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)' }}>Dosage</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)' }}>Days</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)' }}>Total Price</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)', width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prescribedDrugs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No medicines appended to prescription list.
                      </td>
                    </tr>
                  ) : (
                    prescribedDrugs.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '500' }}>{item.medicine_name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{item.dosage}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{item.duration_days}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--color-secondary)' }}>{item.price.toFixed(2)} LKR</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button onClick={() => removePrescribedDrug(index)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>


            {/* Billing & Action Footer */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="label-glass" style={{ margin: 0 }}>Consult Fee</label>
                  <input
                    type="number"
                    className="input-glass"
                    value={isFoc ? '0' : consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    style={{ width: '80px', padding: '6px 10px', textAlign: 'center', opacity: isFoc ? 0.6 : 1 }}
                    disabled={isFoc}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="label-glass" style={{ margin: 0 }}>Free of Charge (FOC)</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isFoc}
                      onChange={(e) => setIsFoc(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bill Summary</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
                    Total: {totalBill.toFixed(2)} LKR
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handlePrintPrescription}>
                  <Printer size={16} /> Print
                </button>
                <button className="btn btn-primary" onClick={handleConfirmAndSend}>
                  <Check size={16} /> Confirm & Send
                </button>
              </div>
            </div>

            </div>
          </section>

        </main>

      </div>

      {/* Print Document Selection Modal */}
      <PrintDocumentModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        userId={user?.id}
        patientName={searchName}
        patientTel={searchTel}
        ageY={ageY}
        ageM={ageM}
        visitDate={visitDateText}
        queueNumber={activeVisit ? activeVisit.queue_number : 1}
        prescriptions={prescribedDrugs}
        diagnosis={diagnosis}
        nextVisitPlan={nextVisitPlan}
        consultationFee={effectiveConsultFee}
        totalBill={totalBill}
        isFoc={isFoc}
        investigations={{ fbc, fbs, lipid_profile: lipidProfile, ufr, crp, esr, dengue_ns1: dengueNs1, influenza_ag: influenzaAg, lft, tft, rft }}
        qrCodeData={qrCodeData}
      />

      {/* All Visits Modal */}
      {showAllVisitsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowAllVisitsModal(false); }}>
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '18px', width: '100%', maxWidth: '900px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 90px rgba(0,0,0,0.35)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '22px 28px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a', fontWeight: '800' }}>All Visits</h3>
                {selectedPatient && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.95rem', color: '#64748b' }}>
                    {selectedPatient.name} &mdash; {history.length} visit{history.length !== 1 ? 's' : ''} recorded
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => { if (selectedPatient) fetchPatientHistory(selectedPatient.id); }}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#64748b' }}
                  title="Refresh history"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => setShowAllVisitsModal(false)}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body - All visits list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No visit records found for this patient.</div>
              ) : (
                history.map((h, i) => {
                  const isExp = modalExpandedVisitId === h.id;
                  const visitDateStr = new Date(h.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const hasMeds = h.prescriptions && h.prescriptions.length > 0;
                  const config = getSavedPrescriptionConfig(user?.id);
                  const refNo = `${config.refPrefix || 'DW'}/${new Date(h.visit_date).getFullYear().toString().slice(2)}${String(new Date(h.visit_date).getMonth() + 1).padStart(2, '0')}${String(new Date(h.visit_date).getDate()).padStart(2, '0')}/${h.id}`;
                  return (
                    <div key={h.id} style={{
                      background: i === 0 ? '#f0f9ff' : '#f8fafc',
                      border: i === 0 ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                      borderRadius: '12px', overflow: 'hidden'
                    }}>
                      {/* Row header */}
                      <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a' }}>{visitDateStr}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '1rem', fontWeight: '700',
                            color: '#1e293b', background: '#e2e8f0',
                            padding: '5px 14px', borderRadius: '8px'
                          }}>Rs. {(parseFloat(h.total_fee) || 0).toFixed(0)}</span>
                          {/* Row action buttons */}
                          <button
                            onClick={() => handlePrintHistoryVisit(h)}
                            style={{
                              background: '#f1f5f9', border: '1px solid #cbd5e1',
                              borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                              color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem'
                            }}
                            title="Print prescription for this visit"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => { handleRepeatPrescription(h); setShowAllVisitsModal(false); }}
                            disabled={!hasMeds}
                            style={{
                              background: hasMeds ? '#0ea5e9' : '#f1f5f9',
                              border: `1px solid ${hasMeds ? '#0284c7' : '#e2e8f0'}`,
                              borderRadius: '8px', padding: '8px 16px', cursor: hasMeds ? 'pointer' : 'not-allowed',
                              color: hasMeds ? '#ffffff' : '#94a3b8',
                              fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px',
                              opacity: hasMeds ? 1 : 0.6, fontWeight: '700'
                            }}
                            title="Repeat this prescription for current visit"
                          >
                            <Copy size={13} /> Repeat this Prescription for this visit
                          </button>
                          <button
                            onClick={() => setModalExpandedVisitId(isExp ? null : h.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#475569', padding: '4px'
                            }}
                          >
                            {isExp ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable diagnosis + meds */}
                      {isExp && (
                        <div style={{ padding: '0 22px 20px', borderTop: '1px solid #e2e8f0' }}>
                          {/* Diagnosis pill/badge row */}
                          <div style={{
                            background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
                            padding: '16px 18px', marginTop: '16px', marginBottom: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                              <span style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>
                                Diagnosis : {h.diagnosis || 'General Checkup'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.85rem', fontWeight: '700', background: '#dbeafe',
                                color: '#1d4ed8', padding: '5px 14px', borderRadius: '8px'
                              }}>Ref : {refNo}</span>
                              {config.signatoryName && (
                                <span style={{
                                  fontSize: '0.85rem', fontWeight: '700', background: '#d1fae5',
                                  color: '#065f46', padding: '5px 14px', borderRadius: '8px'
                                }}>Reviewed by : {config.signatoryName}</span>
                              )}
                            </div>
                          </div>

                          {/* Medicine table */}
                          {hasMeds ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f1f5f9' }}>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontStyle: 'italic', fontWeight: '700', fontSize: '0.9rem' }}>Drug</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontWeight: '700', fontSize: '0.9rem' }}>Dosage</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontWeight: '700', fontSize: '0.9rem' }}>Durat..</th>
                                </tr>
                              </thead>
                              <tbody>
                                {h.prescriptions.map((rx, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '600', fontSize: '1rem' }}>{rx.medicine_name}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0284c7', fontWeight: '800', fontSize: '1rem' }}>{rx.dosage}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontSize: '1rem', fontWeight: '600' }}>{rx.duration_days}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p style={{ color: '#94a3b8', fontSize: '0.95rem', padding: '10px 14px' }}>No prescription recorded for this visit.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', background: '#f8fafc'
            }}>
              <button
                onClick={() => setShowAllVisitsModal(false)}
                style={{
                  padding: '8px 32px', fontSize: '0.95rem', fontWeight: '600',
                  background: '#0ea5e9', color: '#ffffff', border: 'none',
                  borderRadius: '8px', cursor: 'pointer'
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
