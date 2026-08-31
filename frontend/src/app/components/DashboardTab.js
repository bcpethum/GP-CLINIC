'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, DollarSign, Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
      // 1. Fetch Daily Financial Metrics
      const metricsData = await apiFetch(`/queue/stats?date=${selectedDate}`);
      setMetrics({
        patient_count: metricsData.patient_count,
        daily_income: metricsData.daily_income,
        daily_expenditure: metricsData.daily_expenditure,
        net_income: metricsData.net_income
      });

      // 2. Fetch Expenditures list
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
    <div className="tab-scroll-wrapper fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Date Filter Panel */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem' }}>Practice Analytics</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Realtime dashboard of revenue, volume, and operational logs</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} style={{ color: 'var(--color-secondary)' }} />
          <input
            type="date"
            className="input-glass"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: '180px', padding: '6px 12px' }}
          />
        </div>
      </div>

      {/* Metrics Cards Grid (4 Columns) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px'
      }}>
        {/* Card 1: Patient count */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(0,153,255,0.15)', padding: '12px', borderRadius: '10px', color: 'var(--color-secondary)' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily Patient Count</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: '4px' }}>{metrics.patient_count}</div>
          </div>
        </div>

        {/* Card 2: Income */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(16,185,129,0.15)', padding: '12px', borderRadius: '10px', color: 'var(--color-success)' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily Income</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-success)', marginTop: '4px' }}>{metrics.daily_income.toFixed(2)} LKR</div>
          </div>
        </div>

        {/* Card 3: Expenditures */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px', color: 'var(--color-danger)' }}>
            <Wallet size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily Expenditure</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: '4px' }}>{metrics.daily_expenditure.toFixed(2)} LKR</div>
          </div>
        </div>

        {/* Card 4: Net profit */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            background: metrics.net_income >= 0 ? 'rgba(0, 210, 255, 0.15)' : 'rgba(249, 115, 22, 0.15)',
            padding: '12px',
            borderRadius: '10px',
            color: metrics.net_income >= 0 ? 'var(--color-secondary)' : 'var(--color-orange)'
          }}>
            <DollarSign size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Operations Margin</div>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 'bold',
              color: metrics.net_income >= 0 ? 'var(--color-secondary)' : 'var(--color-orange)',
              marginTop: '4px'
            }}>
              {metrics.net_income.toFixed(2)} LKR
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Expenditures logger & list */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px'
      }}>
        {/* Logger Panel */}
        <div className="glass-panel" style={{ gridColumn: 'span 4' }}>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
            Log New Cost / Expenditure
          </h4>

          <form onSubmit={handleAddExpenditure} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                <option value="Drugs">Drugs & Supply stock</option>
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

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
              <Plus size={16} /> Log Expense
            </button>
          </form>
        </div>

        {/* Expenditures list Table */}
        <div className="glass-panel" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Expenditures Register</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {selectedDate}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>Item</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 20px', color: 'var(--text-secondary)', textAlign: 'center', width: '80px' }}>Action</th>
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
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 20px', fontWeight: '500' }}>{item.description}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--color-danger)',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>{item.category}</span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                        -{parseFloat(item.amount).toFixed(2)} LKR
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteExpenditure(item.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>
                          <Trash2 size={15} />
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
