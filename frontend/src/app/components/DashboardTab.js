'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, DollarSign, Wallet, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function DashboardTab({ API_BASE, showAlert, showConfirm }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [metrics, setMetrics] = useState({
    patient_count: 0,
    daily_income: 0,
    daily_expenditure: 0,
    net_income: 0
  });

  const [expenditures, setExpenditures] = useState([]);

  // New expenditure form
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Supplies');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const metricsData = await apiFetch(`/queue/stats?date=${selectedDate}`);
      setMetrics({
        patient_count: metricsData.patient_count,
        daily_income: metricsData.daily_income,
        daily_expenditure: metricsData.daily_expenditure,
        net_income: metricsData.net_income
      });

      const expData = await apiFetch(`/expenditures?date=${selectedDate}`);
      setExpenditures(expData);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpenditure = async (e) => {
    e.preventDefault();
    if (!description || !amount) {
      await showAlert('Please fill out Description and Amount fields.', 'Input Validation');
      return;
    }

    try {
      await apiFetch('/expenditures', {
        method: 'POST',
        body: JSON.stringify({
          description,
          category,
          amount: parseFloat(amount),
          exp_date: selectedDate
        })
      });
      setDescription('');
      setAmount('');
      fetchDashboardData();
    } catch (err) {
      await showAlert('Failed to log expenditure to clinic records.', 'Database Error');
    }
  };

  const handleDeleteExpenditure = async (id) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this expenditure record from the clinic balance sheet?',
      'Delete Expenditure'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/expenditures/${id}`, { method: 'DELETE' });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="tab-scroll-wrapper fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Date Filter Panel ── */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '14px 20px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Practice Analytics</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Realtime dashboard of revenue, volume, and operational logs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
          <input
            type="date"
            className="input-glass"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: '160px', padding: '6px 10px', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* ── 4 Metric Cards ── */}
      <div className="dashboard-metric-cards">

        {/* Card 1: Patient Count */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            background: 'rgba(0,153,255,0.12)',
            padding: '10px',
            borderRadius: '10px',
            color: 'var(--color-secondary)',
            flexShrink: 0
          }}>
            <Users size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Daily Patient Count</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 'bold', color: 'var(--color-primary)', lineHeight: 1.2, marginTop: '2px' }}>{metrics.patient_count}</div>
          </div>
        </div>

        {/* Card 2: Daily Income */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            background: 'rgba(16,185,129,0.12)',
            padding: '10px',
            borderRadius: '10px',
            color: 'var(--color-success)',
            flexShrink: 0
          }}>
            <TrendingUp size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Daily Income</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 'bold', color: 'var(--color-success)', lineHeight: 1.2, marginTop: '2px' }}>
              {Number(metrics.daily_income).toFixed(2)}
              <span style={{ fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>LKR</span>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expenditure */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            padding: '10px',
            borderRadius: '10px',
            color: 'var(--color-danger)',
            flexShrink: 0
          }}>
            <Wallet size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Daily Expenditure</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 'bold', color: 'var(--color-danger)', lineHeight: 1.2, marginTop: '2px' }}>
              {Number(metrics.daily_expenditure).toFixed(2)}
              <span style={{ fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>LKR</span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Operations Margin */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            background: metrics.net_income >= 0 ? 'rgba(0,210,255,0.12)' : 'rgba(249,115,22,0.12)',
            padding: '10px',
            borderRadius: '10px',
            color: metrics.net_income >= 0 ? 'var(--color-secondary)' : 'var(--color-orange)',
            flexShrink: 0
          }}>
            <DollarSign size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Net Operations Margin</div>
            <div style={{
              fontSize: '1.9rem',
              fontWeight: 'bold',
              color: metrics.net_income >= 0 ? 'var(--color-secondary)' : 'var(--color-orange)',
              lineHeight: 1.2,
              marginTop: '2px'
            }}>
              {Number(metrics.net_income).toFixed(2)}
              <span style={{ fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>LKR</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Expenditure Section: Logger + Table ── */}
      <div className="dashboard-expenditure">

        {/* Logger Panel */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', margin: '0 0 14px 0' }}>
            Log New Cost / Expenditure
          </h4>

          <form onSubmit={handleAddExpenditure} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label className="label-glass">Description</label>
              <input
                type="text"
                className="input-glass"
                placeholder="e.g. Bought Antibiotics stock"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label-glass">Category</label>
              <select
                className="input-glass"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ appearance: 'none' }}
              >
                <option value="Drugs">Drugs &amp; Supply stock</option>
                <option value="Supplies">Medical Supplies</option>
                <option value="Rent">Rent / Lease</option>
                <option value="Utilities">Utilities (Water, Power, Net)</option>
                <option value="Salaries">Staff Salaries</option>
                <option value="Other">Other Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="label-glass">Amount (LKR)</label>
              <input
                type="number"
                step="0.01"
                className="input-glass"
                placeholder="LKR amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '6px' }}>
              <Plus size={15} /> Log Expense
            </button>
          </form>
        </div>

        {/* Expenditures Table Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0, minWidth: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Expenditures Register</h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date: {selectedDate}</span>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '380px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left', minWidth: '360px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,100,200,0.04)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center', width: '70px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ledger...</td>
                  </tr>
                ) : expenditures.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No expenditures registered for this date.
                    </td>
                  </tr>
                ) : (
                  expenditures.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.description}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          fontSize: '0.73rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--color-danger)',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>{item.category}</span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                        -{parseFloat(item.amount).toFixed(2)} LKR
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteExpenditure(item.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
