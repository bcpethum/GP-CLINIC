'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Shield, Users, Building, Plus, Trash2,
  Edit2, Check, RefreshCw, KeyRound, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, UserPlus, FileText, Printer, Upload,
  Image as ImageIcon, Eye, RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  DEFAULT_PRESCRIPTION_CONFIG,
  getSavedPrescriptionConfig,
  savePrescriptionConfig,
  buildPrescriptionHtml,
  generateReferenceNo
} from '../lib/prescriptionConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Permission toggle row helper
// ─────────────────────────────────────────────────────────────────────────────
function PermToggle({ label, value, onChange, disabled }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid rgba(0, 100, 200, 0.08)'
    }}>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          background: 'none',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          color: value ? 'var(--color-secondary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8rem',
          fontWeight: '600',
          opacity: disabled ? 0.5 : 1
        }}
      >
        {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        <span style={{ color: value ? 'var(--color-secondary)' : 'var(--text-muted)', minWidth: '30px' }}>
          {value ? 'ON' : 'OFF'}
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Assistant Item Row
// ─────────────────────────────────────────────────────────────────────────────
function AssistantRow({
  assistant,
  isExpanded,
  onToggleExpand,
  editingId,
  setEditingId,
  editName,
  setEditName,
  editEmail,
  setEditEmail,
  handleSaveEdit,
  handleToggleStatus,
  handleDelete,
  handleSavePermissions,
  saving,
  resetPasscodeId,
  setResetPasscodeId,
  newResetPasscode,
  setNewResetPasscode,
  handleResetPasscode
}) {
  const [localPerms, setLocalPerms] = useState({
    dashboard: !!assistant.dashboard,
    patients: !!assistant.patients,
    drugs: !!assistant.drugs,
    expenditures: !!assistant.expenditures,
    queue: !!assistant.queue,
    sms: !!assistant.sms,
    assistant: !!assistant.assistant,
    doctor: !!assistant.doctor,
    settings: !!assistant.settings
  });

  useEffect(() => {
    setLocalPerms({
      dashboard: !!assistant.dashboard,
      patients: !!assistant.patients,
      drugs: !!assistant.drugs,
      expenditures: !!assistant.expenditures,
      queue: !!assistant.queue,
      sms: !!assistant.sms,
      assistant: !!assistant.assistant,
      doctor: !!assistant.doctor,
      settings: !!assistant.settings
    });
  }, [assistant]);

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0, 100, 200, 0.15)', boxShadow: '0 4px 16px rgba(0, 80, 180, 0.06)' }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: isExpanded ? 'rgba(0, 119, 230, 0.05)' : 'transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '700', fontSize: '1rem', color: 'white'
          }}>
            {assistant.name ? assistant.name[0].toUpperCase() : 'A'}
          </div>
          <div>
            {editingId === assistant.id ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input-glass"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.85rem', width: '130px' }}
                />
                <input
                  type="email"
                  className="input-glass"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.85rem', width: '180px' }}
                />
                <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleSaveEdit(assistant.id)}>Save</button>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{assistant.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{assistant.email}</div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.72rem', padding: '3px 10px', borderRadius: '10px', fontWeight: '600',
            background: assistant.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
            color: assistant.is_active ? 'var(--color-success)' : 'var(--color-danger)'
          }}>
            {assistant.is_active ? 'Active' : 'Inactive'}
          </span>
          <button title="Edit info" className="btn btn-secondary" style={{ padding: '5px 8px' }} onClick={() => {
            setEditingId(assistant.id); setEditName(assistant.name); setEditEmail(assistant.email);
          }}>
            <Edit2 size={13} />
          </button>
          <button title={assistant.is_active ? 'Deactivate' : 'Activate'} className="btn btn-secondary" style={{ padding: '5px 8px' }} onClick={() => handleToggleStatus(assistant)}>
            {assistant.is_active ? <ToggleRight size={15} style={{ color: 'var(--color-success)' }} /> : <ToggleLeft size={15} />}
          </button>
          <button title="Delete" className="btn btn-danger" style={{ padding: '5px 8px' }} onClick={() => handleDelete(assistant)}>
            <Trash2 size={13} />
          </button>
          <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.78rem' }} onClick={onToggleExpand}>
            Manage {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded management panel */}
      {isExpanded && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid rgba(0, 100, 200, 0.12)', animation: 'fadeIn 0.2s ease', background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Permissions column */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Page Access Permissions
              </h4>
              <PermToggle label="Dashboard" value={localPerms.dashboard} onChange={v => setLocalPerms(p => ({ ...p, dashboard: v }))} />
              <PermToggle label="Patients" value={localPerms.patients} onChange={v => setLocalPerms(p => ({ ...p, patients: v }))} />
              <PermToggle label="Drugs" value={localPerms.drugs} onChange={v => setLocalPerms(p => ({ ...p, drugs: v }))} />
              <PermToggle label="Assistant" value={localPerms.assistant} onChange={v => setLocalPerms(p => ({ ...p, assistant: v }))} />
              <PermToggle label="SMS" value={localPerms.sms} onChange={v => setLocalPerms(p => ({ ...p, sms: v }))} />
              <PermToggle label="Doctor (Settings)" value={localPerms.doctor} onChange={v => setLocalPerms(p => ({ ...p, doctor: v }))} />
              <PermToggle label="Settings" value={localPerms.settings} onChange={v => setLocalPerms(p => ({ ...p, settings: v }))} />
              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                  onClick={() => handleSavePermissions(assistant, localPerms)} disabled={saving}>
                  {saving ? 'Saving...' : <><Check size={14} /> Save Permissions</>}
                </button>
              </div>
            </div>

            {/* Passcode reset column */}
            <div>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reset 4-Digit Passcode
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Assign a new 4-digit numeric login passcode for this assistant.
              </p>
              {resetPasscodeId === assistant.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="password"
                    className="input-glass"
                    placeholder="New passcode (4 digits)"
                    value={newResetPasscode}
                    maxLength={4}
                    inputMode="numeric"
                    onChange={e => setNewResetPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{ letterSpacing: '0.4em', textAlign: 'center', width: '160px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => handleResetPasscode(assistant.id)}>
                      <KeyRound size={13} /> Reset
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => { setResetPasscodeId(null); setNewResetPasscode(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => setResetPasscodeId(assistant.id)}>
                  <KeyRound size={14} /> Change Passcode
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Doctor's Assistant Management Panel
// ─────────────────────────────────────────────────────────────────────────────
function AssistantManagement({ showAlert, showConfirm }) {
  const [assistants, setAssistants] = useState([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [creating, setCreating] = useState(false);

  // Passcode reset
  const [resetPasscodeId, setResetPasscodeId] = useState(null);
  const [newResetPasscode, setNewResetPasscode] = useState('');

  // Edit name/email
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    fetchAssistants();
  }, []);

  const fetchAssistants = async () => {
    setLoadingAssistants(true);
    try {
      const data = await api.get('/assistants');
      setAssistants(data);
    } catch (err) {
      console.error('Error fetching assistants:', err);
    } finally {
      setLoadingAssistants(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPasscode) {
      await showAlert('Please fill all fields.', 'Validation Error');
      return;
    }
    if (!/^\d{4}$/.test(newPasscode)) {
      await showAlert('Passcode must be exactly 4 numeric digits.', 'Validation Error');
      return;
    }
    setCreating(true);
    try {
      await api.post('/assistants', { name: newName, email: newEmail, passcode: newPasscode });
      await showAlert(`Assistant "${newName}" created successfully!`, 'Success');
      setNewName(''); setNewEmail(''); setNewPasscode('');
      setShowCreateForm(false);
      fetchAssistants();
    } catch (err) {
      await showAlert(err.message || 'Failed to create assistant.', 'Error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (assistant) => {
    const confirmed = await showConfirm(
      `Are you sure you want to permanently delete "${assistant.name}"'s account? This cannot be undone.`,
      'Delete Assistant'
    );
    if (!confirmed) return;
    try {
      await api.delete(`/assistants/${assistant.id}`);
      setAssistants(prev => prev.filter(a => a.id !== assistant.id));
      if (expandedId === assistant.id) setExpandedId(null);
    } catch (err) {
      await showAlert(err.message || 'Failed to delete assistant.', 'Error');
    }
  };

  const handleToggleStatus = async (assistant) => {
    const newStatus = !assistant.is_active;
    const confirmed = await showConfirm(
      `${newStatus ? 'Activate' : 'Deactivate'} "${assistant.name}"'s account?`,
      `${newStatus ? 'Activate' : 'Deactivate'} Assistant`
    );
    if (!confirmed) return;
    try {
      const updated = await api.put(`/assistants/${assistant.id}/status`, { is_active: newStatus });
      setAssistants(prev => prev.map(a => a.id === assistant.id ? { ...a, is_active: updated.is_active } : a));
    } catch (err) {
      await showAlert(err.message || 'Failed to update status.', 'Error');
    }
  };

  const handleSavePermissions = async (assistant, perms) => {
    setSaving(true);
    try {
      await api.put(`/assistants/${assistant.id}/permissions`, perms);
      setAssistants(prev => prev.map(a => a.id === assistant.id ? { ...a, ...perms } : a));
      await showAlert('Permissions saved successfully!', 'Saved');
    } catch (err) {
      await showAlert(err.message || 'Failed to save permissions.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (assistantId) => {
    if (!editName.trim() || !editEmail.trim()) {
      await showAlert('Name and email are required.', 'Validation Error');
      return;
    }
    try {
      const updated = await api.put(`/assistants/${assistantId}`, { name: editName, email: editEmail });
      setAssistants(prev => prev.map(a => a.id === assistantId ? { ...a, name: updated.name, email: updated.email } : a));
      setEditingId(null);
      await showAlert('Assistant details updated!', 'Saved');
    } catch (err) {
      await showAlert(err.message || 'Failed to update assistant.', 'Error');
    }
  };

  const handleResetPasscode = async (assistantId) => {
    if (!newResetPasscode || !/^\d{4}$/.test(newResetPasscode)) {
      await showAlert('Enter exactly 4 numeric digits for the new passcode.', 'Validation Error');
      return;
    }
    try {
      await api.put(`/assistants/${assistantId}/passcode`, { passcode: newResetPasscode });
      setResetPasscodeId(null);
      setNewResetPasscode('');
      await showAlert('Passcode reset successfully!', 'Saved');
    } catch (err) {
      await showAlert(err.message || 'Failed to reset passcode.', 'Error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#ffffff', border: '1px solid var(--glass-border)',
        borderRadius: '12px', padding: '14px 18px',
        boxShadow: '0 4px 16px rgba(0, 80, 180, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={20} style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: '700' }}>Assistant Staff Management</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{assistants.length} assistant(s) registered</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={fetchAssistants} disabled={loadingAssistants}>
            <RefreshCw size={14} className={loadingAssistants ? 'spin-anim' : ''} />
          </button>
          <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem' }} onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={14} /> Create Assistant
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.2s ease', background: '#ffffff', border: '1px solid var(--glass-border)', boxShadow: '0 8px 24px rgba(0, 80, 180, 0.08)' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--color-primary)', fontWeight: '700' }}>New Assistant Account</h4>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-glass">Full Name</label>
                <input type="text" className="input-glass" placeholder="Assistant Name" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div>
                <label className="label-glass">Email Address</label>
                <input type="email" className="input-glass" placeholder="assistant@clinic.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ maxWidth: '200px' }}>
              <label className="label-glass">4-Digit Passcode</label>
              <input
                type="password"
                className="input-glass"
                placeholder="••••"
                value={newPasscode}
                maxLength={4}
                inputMode="numeric"
                onChange={e => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                style={{ letterSpacing: '0.4em', textAlign: 'center' }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Exactly 4 numeric digits</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={creating}>
                {creating ? 'Creating...' : <><Check size={14} /> Create Assistant</>}
              </button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assistants List */}
      {loadingAssistants ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Loading assistants...</div>
      ) : assistants.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: '#ffffff' }}>
          <UserPlus size={40} style={{ marginBottom: '10px', opacity: 0.4 }} />
          <p>No assistants yet. Click &quot;Create Assistant&quot; to add staff.</p>
        </div>
      ) : (
        assistants.map(assistant => (
          <AssistantRow
            key={assistant.id}
            assistant={assistant}
            isExpanded={expandedId === assistant.id}
            onToggleExpand={() => setExpandedId(expandedId === assistant.id ? null : assistant.id)}
            editingId={editingId}
            setEditingId={setEditingId}
            editName={editName}
            setEditName={setEditName}
            editEmail={editEmail}
            setEditEmail={setEditEmail}
            handleSaveEdit={handleSaveEdit}
            handleToggleStatus={handleToggleStatus}
            handleDelete={handleDelete}
            handleSavePermissions={handleSavePermissions}
            saving={saving}
            resetPasscodeId={resetPasscodeId}
            setResetPasscodeId={setResetPasscodeId}
            newResetPasscode={newResetPasscode}
            setNewResetPasscode={setNewResetPasscode}
            handleResetPasscode={handleResetPasscode}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescription Template Editor & Live Preview Component
// ─────────────────────────────────────────────────────────────────────────────
function PrescriptionDesignSection({ showAlert }) {
  const { user } = useAuth();
  const doctorId = user?.id;
  const [config, setConfig] = useState(DEFAULT_PRESCRIPTION_CONFIG);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('header'); // 'header' | 'seal' | 'signature'

  useEffect(() => {
    // 1. Load from localStorage (scoped to this doctor)
    const saved = getSavedPrescriptionConfig(doctorId);
    setConfig(saved);

    // 2. Fetch from backend API
    api.get('/settings/prescription_template')
      .then(res => {
        if (res && res.value) {
          const merged = { ...DEFAULT_PRESCRIPTION_CONFIG, ...res.value };
          setConfig(merged);
          savePrescriptionConfig(merged, doctorId);
        }
      })
      .catch(err => console.log('Using local prescription config:', err.message));
  }, []);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Convert uploaded image to Base64 data URL
  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleChange(field, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      savePrescriptionConfig(config, doctorId);
      await api.put('/settings/prescription_template', config).catch(() => { });
      await showAlert('Prescription design template saved successfully!', 'Design Saved');
    } catch (err) {
      await showAlert('Saved to local storage!', 'Saved');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (confirm('Reset prescription template design back to default?')) {
      setConfig(DEFAULT_PRESCRIPTION_CONFIG);
      savePrescriptionConfig(DEFAULT_PRESCRIPTION_CONFIG, doctorId);
      await showAlert('Prescription template reset to default values.', 'Reset Complete');
    }
  };

  const handleTestPrint = () => {
    const sampleItems = [
      { medicine_name: 'Paracetamol 500mg', dosage: '1-0-1', duration_days: 3 },
      { medicine_name: 'Amoxicillin 500mg', dosage: '1 tds', duration_days: 5 },
      { medicine_name: 'Cetirizine 10mg', dosage: '0-0-1', duration_days: 3 }
    ];

    const html = buildPrescriptionHtml({
      config,
      patientName: 'Kamal Kumara',
      ageText: '28 Years 4 Month(s)',
      allergies: 'None',
      visitDate: new Date().toISOString().split('T')[0],
      queueNumber: 8,
      prescriptions: sampleItems,
      planOfAction: 'Review in 5 days if fever persists.'
    });

    const printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'flex-start' }}>

      {/* LEFT COLUMN: Controls & Uploads */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-secondary)', margin: 0 }}>
              Prescription Template Designer
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Customize clinic logo, doctor credentials, official seal &amp; signature
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={handleResetDefaults}
              title="Reset defaults"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-secondary)' }}
              onClick={handleTestPrint}
            >
              <Printer size={14} /> Test Print
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(0, 100, 200, 0.06)',
          borderRadius: '8px',
          padding: '3px',
          border: '1px solid var(--glass-border)'
        }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('header')}
            style={{
              padding: '7px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeSubTab === 'header' ? 'var(--accent-blue-bg)' : 'transparent',
              color: activeSubTab === 'header' ? 'var(--color-secondary)' : 'var(--text-secondary)'
            }}
          >
            Header &amp; Doctor
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('seal')}
            style={{
              padding: '7px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeSubTab === 'seal' ? 'var(--accent-blue-bg)' : 'transparent',
              color: activeSubTab === 'seal' ? 'var(--color-secondary)' : 'var(--text-secondary)'
            }}
          >
            Doctor Seal / Stamp
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('signature')}
            style={{
              padding: '7px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeSubTab === 'signature' ? 'var(--accent-blue-bg)' : 'transparent',
              color: activeSubTab === 'signature' ? 'var(--color-secondary)' : 'var(--text-secondary)'
            }}
          >
            Signature &amp; Format
          </button>
        </div>

        {/* SUBTAB 1: Header & Doctor Details */}
        {activeSubTab === 'header' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease' }}>

            {/* Clinic Logo */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Clinic Logo</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={config.showClinicLogo}
                    onChange={e => handleChange('showClinicLogo', e.target.checked)}
                  />
                  Show Logo
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '120px',
                  height: '85px',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '6px',
                  boxShadow: '0 2px 8px rgba(0, 80, 180, 0.08)'
                }}>
                  {config.clinicLogo ? (
                    <img src={config.clinicLogo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>Default Icon</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={13} /> Upload Custom Logo (PNG/JPG)
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, 'clinicLogo')} />
                  </label>
                  {config.clinicLogo && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      onClick={() => handleChange('clinicLogo', '')}
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Clinic Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-glass">Clinic Header Name</label>
                <input
                  type="text"
                  className="input-glass"
                  value={config.clinicName}
                  onChange={e => handleChange('clinicName', e.target.value)}
                  placeholder="Medical Centre"
                />
              </div>
              <div>
                <label className="label-glass">Telephone (T.P)</label>
                <input
                  type="text"
                  className="input-glass"
                  value={config.clinicPhone}
                  onChange={e => handleChange('clinicPhone', e.target.value)}
                  placeholder="0711234567"
                />
              </div>
            </div>

            {/* Doctor Details */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label-glass">Doctor Display Name</label>
                <input
                  type="text"
                  className="input-glass"
                  value={config.doctorName}
                  onChange={e => handleChange('doctorName', e.target.value)}
                  placeholder="Dr. (Name)"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label-glass">Doctor Qualifications</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={config.doctorQualifications}
                    onChange={e => handleChange('doctorQualifications', e.target.value)}
                    placeholder="MBBS (Peradeniya)"
                  />
                </div>
                <div>
                  <label className="label-glass">Medical Council / SLMC Reg No</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={config.doctorRegNo}
                    onChange={e => handleChange('doctorRegNo', e.target.value)}
                    placeholder="SLMC Reg no - 12345"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* SUBTAB 2: Doctor Seal / Stamp */}
        {activeSubTab === 'seal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Official Stamp / Seal Settings</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={config.showSeal}
                  onChange={e => handleChange('showSeal', e.target.checked)}
                />
                Show Stamp on Print
              </label>
            </div>

            {/* Seal Mode Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${config.sealType === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px' }}
                onClick={() => handleChange('sealType', 'digital')}
              >
                Digital Blue Ink Seal
              </button>
              <button
                type="button"
                className={`btn ${config.sealType === 'image' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px' }}
                onClick={() => handleChange('sealType', 'image')}
              >
                Upload Seal Image
              </button>
            </div>

            {config.sealType === 'digital' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <div>
                  <label className="label-glass">Seal Doctor Title</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={config.sealTitle}
                    onChange={e => handleChange('sealTitle', e.target.value)}
                    placeholder="Dr. (Name)"
                  />
                </div>
                <div>
                  <label className="label-glass">Seal Degrees &amp; Institution</label>
                  <input
                    type="text"
                    className="input-glass"
                    value={config.sealDegree}
                    onChange={e => handleChange('sealDegree', e.target.value)}
                    placeholder="MBBS (Peradeniya, Sri Lanka)"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="label-glass">Seal SLMC Reg No</label>
                    <input
                      type="text"
                      className="input-glass"
                      value={config.sealRegNo}
                      onChange={e => handleChange('sealRegNo', e.target.value)}
                      placeholder="SLMC Reg No: 12345"
                    />
                  </div>
                  <div>
                    <label className="label-glass">Seal Contact Tel</label>
                    <input
                      type="text"
                      className="input-glass"
                      value={config.sealPhone}
                      onChange={e => handleChange('sealPhone', e.target.value)}
                      placeholder="071 1234567"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Upload a transparent PNG or high-res photo of your physical clinic seal/stamp.
                </span>
                {config.sealImage && (
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', textAlign: 'center', maxHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={config.sealImage} alt="Seal Preview" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <label className="btn btn-secondary" style={{ padding: '8px', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Upload size={14} /> Choose Seal Image
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, 'sealImage')} />
                </label>
                {config.sealImage && (
                  <button type="button" className="btn btn-danger" style={{ padding: '6px', fontSize: '0.75rem' }} onClick={() => handleChange('sealImage', '')}>
                    Remove Uploaded Seal
                  </button>
                )}
              </div>
            )}

          </div>
        )}

        {/* SUBTAB 3: Signature & Numbering */}
        {activeSubTab === 'signature' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Authorized Signature Settings</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={config.showSignature}
                  onChange={e => handleChange('showSignature', e.target.checked)}
                />
                Show Signature on Print
              </label>
            </div>

            <div>
              <label className="label-glass">Signatory Doctor Name (Printed Below Line)</label>
              <input
                type="text"
                className="input-glass"
                value={config.signatoryName}
                onChange={e => handleChange('signatoryName', e.target.value)}
                placeholder=""
              />
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Upload doctor digital signature image (transparent PNG recommended).
              </span>
              {config.signatureImage && (
                <div style={{ background: '#fff', padding: '8px', borderRadius: '8px', textAlign: 'center', maxHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={config.signatureImage} alt="Signature Preview" style={{ maxHeight: '55px', maxWidth: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <label className="btn btn-secondary" style={{ padding: '8px', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Upload size={14} /> Upload Doctor Signature Image
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, 'signatureImage')} />
              </label>
              {config.signatureImage && (
                <button type="button" className="btn btn-danger" style={{ padding: '6px', fontSize: '0.75rem' }} onClick={() => handleChange('signatureImage', '')}>
                  Remove Signature
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label-glass">Rx Section Title</label>
                <input
                  type="text"
                  className="input-glass"
                  value={config.rxTitle}
                  onChange={e => handleChange('rxTitle', e.target.value)}
                  placeholder="Rx : (Outside)"
                />
              </div>
              <div>
                <label className="label-glass">Ref No. Prefix</label>
                <input
                  type="text"
                  className="input-glass"
                  value={config.refPrefix}
                  onChange={e => handleChange('refPrefix', e.target.value)}
                  placeholder="DW"
                />
              </div>
            </div>

          </div>
        )}

        {/* Save Button */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '10px 24px', fontSize: '0.9rem' }}
          >
            {saving ? 'Saving...' : <><Check size={16} /> Save Prescription Design</>}
          </button>
        </div>

      </div>

      {/* RIGHT COLUMN: Live Interactive A5 Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={15} /> Live Paper Output Preview
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Standard A5 Document</span>
        </div>

        {/* A5 Sheet Simulation */}
        <div style={{
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: '10px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
          padding: '22px 24px',
          fontSize: '13px',
          border: '1px solid #e2e8f0',
          transform: 'scale(0.98)',
          transformOrigin: 'top center'
        }}>
          <div>
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              {/* Logo */}
              <div style={{ width: '35%' }}>
                {config.showClinicLogo && (
                  <div>
                    {config.clinicLogo ? (
                      <img src={config.clinicLogo} alt="Logo" style={{ maxHeight: '110px', maxWidth: '180px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '85px', height: '85px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '38px' }}>+</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clinic details */}
              <div style={{ textAlign: 'right', width: '65%' }}>
                <div style={{ display: 'inline-block', textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', whiteSpace: 'nowrap' }}>{config.clinicName || 'Suwa Sahana Medical Centre'}</div>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#334155', margin: '2px 0 5px', whiteSpace: 'nowrap' }}>T.P - {config.clinicPhone || '0772582613'}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap' }}>{config.doctorName || 'Dr. B.S. Pathum'}</div>
                  <div style={{ fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>{config.doctorQualifications || 'MBBS (Peradeniya)'}</div>
                  <div style={{ fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>{config.doctorRegNo || 'SLMC Reg no - 39737'}</div>
                </div>
              </div>
            </div>

            {/* Reference divider */}
            <div style={{ marginTop: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                Ref No: {generateReferenceNo(config.refPrefix || 'DW', new Date().toISOString(), 8)}
              </div>
              <div style={{ borderTop: '1.5px solid #cbd5e1' }}></div>
            </div>

            {/* Patient Info */}
            <div style={{ marginBottom: '14px', lineHeight: '1.55', fontSize: '13px' }}>
              <div><strong style={{ color: '#0f172a' }}>Name :</strong> Kamal Kumara</div>
              <div><strong style={{ color: '#0f172a' }}>Age :</strong> 28 Years 4 Month(s)</div>
            </div>

            {/* Rx Section */}
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>{config.rxTitle || 'Rx : (Outside)'}</div>

              {/* Header Pill */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                background: '#bae6fd',
                color: '#0369a1',
                fontWeight: '800',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                marginBottom: '6px'
              }}>
                <div>Medicine</div>
                <div>Dosage</div>
                <div>Duration</div>
              </div>

              {/* Sample Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px dashed #e2e8f0', fontSize: '12.5px' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Paracetamol 500mg</span>
                  <span style={{ fontWeight: '600' }}>1-0-1</span>
                  <span style={{ fontWeight: '600', color: '#475569' }}>3 Days</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px dashed #e2e8f0', fontSize: '12.5px' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Amoxicillin 500mg</span>
                  <span style={{ fontWeight: '600' }}>1 tds</span>
                  <span style={{ fontWeight: '600', color: '#475569' }}>5 Days</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '6px 12px', borderBottom: '1px dashed #e2e8f0', fontSize: '12.5px' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Cetirizine 10mg</span>
                  <span style={{ fontWeight: '600' }}>0-0-1</span>
                  <span style={{ fontWeight: '600', color: '#475569' }}>3 Days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sign-off Area with comfortable space */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '28px' }}>

              {/* Date & Seal */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>
                  Date: <strong>{new Date().toISOString().split('T')[0]}</strong>
                </div>
                {config.showSeal && (
                  <div>
                    {config.sealType === 'image' && config.sealImage ? (
                      <img src={config.sealImage} alt="Seal" style={{ maxHeight: '70px', maxWidth: '160px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{
                        border: '1.5px solid #1d4ed8',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: '#1d4ed8',
                        textAlign: 'center',
                        transform: 'rotate(-1.5deg)',
                        fontSize: '10.5px',
                        background: 'rgba(37,99,235,0.02)'
                      }}>
                        <div style={{ fontWeight: '800', fontSize: '12.5px' }}>{config.sealTitle || config.doctorName || ''}</div>
                        <div style={{ fontWeight: '700' }}>{config.sealDegree || config.doctorQualifications || ''}</div>
                        <div style={{ fontWeight: '700' }}>{config.sealRegNo || config.doctorRegNo || ''}</div>
                        <div style={{ fontWeight: '700' }}>☎ {config.sealPhone || config.clinicPhone || ''}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Signature */}
              <div style={{ textAlign: 'right' }}>
                {config.showSignature && (
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: '6px' }}>Authorized Signature :</div>
                    <div style={{ minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {config.signatureImage ? (
                        <img src={config.signatureImage} alt="Signature" style={{ maxHeight: '44px', maxWidth: '140px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ fontFamily: 'Brush Script MT, cursive', fontSize: '20px', color: '#1e3a8a' }}>
                          {config.signatoryName || 'Dr. Pathum'}
                        </div>
                      )}
                    </div>
                    <div style={{ borderBottom: '1.5px dotted #64748b', width: '150px', marginLeft: 'auto', marginBottom: '3px' }}></div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>{config.signatoryName || config.doctorName || 'Dr. Shanaka Pathum'}</div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsTab Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsTab({ API_BASE, showAlert, showConfirm, user }) {
  const [activeSection, setActiveSection] = useState('prescription'); // 'assistants' | 'clinic' | 'prescription'
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');

  const handleSaveClinicSettings = async (e) => {
    e.preventDefault();
    await showAlert('Clinic configurations saved successfully!', 'Settings Saved');
  };

  return (
    <div className="tab-scroll-wrapper fade-in" style={{ maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Settings Navigation Header */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 4px 15px rgba(0,153,255,0.3)'
          }}>
            <SettingsIcon size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>Clinical Settings &amp; Customization</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure assistant permissions, prescription templates, seal, signature &amp; practice details</span>
          </div>
        </div>

        {/* Section Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 100, 200, 0.06)',
          borderRadius: '10px',
          padding: '4px',
          border: '1px solid var(--glass-border)',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveSection('prescription')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'prescription'
                ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                : 'transparent',
              color: activeSection === 'prescription' ? 'white' : 'var(--text-secondary)',
              fontWeight: activeSection === 'prescription' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={15} />
            Prescription Design
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('assistants')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'assistants'
                ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                : 'transparent',
              color: activeSection === 'assistants' ? 'white' : 'var(--text-secondary)',
              fontWeight: activeSection === 'assistants' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={15} />
            Assistant Staff
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('clinic')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === 'clinic'
                ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
                : 'transparent',
              color: activeSection === 'clinic' ? 'white' : 'var(--text-secondary)',
              fontWeight: activeSection === 'clinic' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Building size={15} />
            Clinic Info
          </button>
        </div>
      </div>

      {/* Section 1: Prescription Template Design */}
      {activeSection === 'prescription' && (
        <PrescriptionDesignSection showAlert={showAlert} />
      )}

      {/* Section 2: Assistant Staff Management */}
      {activeSection === 'assistants' && (
        <AssistantManagement showAlert={showAlert} showConfirm={showConfirm} />
      )}

      {/* Section 3: Clinic General Information */}
      {activeSection === 'clinic' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-secondary)', marginBottom: '4px' }}>
              Practice Profile &amp; Letterhead Details
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              These details appear on printed prescriptions, receipts, and patient tokens.
            </p>
          </div>

          <form onSubmit={handleSaveClinicSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="label-glass">Clinic Name</label>
                <input
                  type="text"
                  className="input-glass"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder=""
                  required
                />
              </div>
              <div>
                <label className="label-glass">Primary Contact Number</label>
                <input
                  type="text"
                  className="input-glass"
                  value={clinicPhone}
                  onChange={e => setClinicPhone(e.target.value)}
                  placeholder=""
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-glass">Clinic Address / Location</label>
              <input
                type="text"
                className="input-glass"
                value={clinicAddress}
                onChange={e => setClinicAddress(e.target.value)}
                placeholder=""
              />
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                <Check size={16} /> Save Clinic Info
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
