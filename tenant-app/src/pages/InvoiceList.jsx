import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmt(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

function statusBadge(s) {
  if (s === 'PENDING') return <span className="badge pending">รอชำระ</span>;
  if (s === 'REVIEW')  return <span className="badge review">รอตรวจสอบ</span>;
  return                      <span className="badge paid">ชำระแล้ว</span>;
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError]       = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api.listInvoices().then(setInvoices).catch(e => setError(e.message));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => nav('/')}>← กลับ</button>
        <h1>ประวัติการชำระ</h1>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {!invoices && !error && (
        <div className="center-msg"><p className="sub">กำลังโหลด...</p></div>
      )}

      {invoices?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#6b7280' }}>
          ยังไม่มีประวัติใบแจ้งหนี้
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {invoices?.map(inv => (
          <div key={inv.id} className="invoice-item" onClick={() => nav(`/invoices/${inv.id}`)}>
            <div>
              <div className="month">{MONTHS[inv.month]} {inv.year + 543}</div>
              <div style={{ marginTop: 4 }}>{statusBadge(inv.status)}</div>
            </div>
            <div className="amount">฿{fmt(inv.totalAmount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
