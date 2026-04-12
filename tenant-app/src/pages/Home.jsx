import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function statusLabel(s) {
  if (s === 'PENDING') return { text: 'รอชำระ',    cls: 'pending' };
  if (s === 'REVIEW')  return { text: 'รอตรวจสอบ', cls: 'review'  };
  return                      { text: 'ชำระแล้ว',  cls: 'paid'    };
}

function fmt(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Home() {
  const [me, setMe]       = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api.getMe()
      .then(setMe)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="center-msg">
      <p className="icon">😕</p>
      <p className="title">ไม่พบข้อมูล</p>
      <p className="sub">{error}</p>
    </div>
  );

  if (!me) return (
    <div className="center-msg">
      <p className="sub">กำลังโหลด...</p>
    </div>
  );

  const inv = me.currentInvoice;
  const st  = inv ? statusLabel(inv.status) : null;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <h1>สวัสดี, {me.nickname || me.name} 👋</h1>
        <p>ห้อง {me.room?.roomNumber ?? '—'}</p>
      </div>

      {/* Current invoice */}
      {inv ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">บิลปัจจุบัน — {MONTHS[inv.month]} {inv.year + 543}</div>
          <div className="amount-big">฿{fmt(inv.totalAmount)}</div>
          <div className="amount-label">
            <span className={`badge ${st.cls}`}>{st.text}</span>
          </div>
          <hr className="divider" />
          {inv.items.map(item => (
            <div className="row" key={item.id}>
              <span className="label">{item.label}</span>
              <span className="value">฿{fmt(item.amount)}</span>
            </div>
          ))}
          {inv.dueDate && (
            <>
              <hr className="divider" />
              <div className="row">
                <span className="label">กำหนดชำระ</span>
                <span className="value">
                  {new Date(inv.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
            </>
          )}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inv.status === 'PENDING' && (
              <button className="btn btn-primary" onClick={() => nav(`/invoices/${inv.id}`)}>
                📎 แนบสลิปการโอน
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => nav('/invoices')}>
              ประวัติการชำระ
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 32 }}>✅</p>
          <p style={{ fontWeight: 700, marginTop: 8 }}>ไม่มีบิลค้างชำระ</p>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>เรียบร้อยดีครับ</p>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => nav('/invoices')}>
            ดูประวัติการชำระ
          </button>
        </div>
      )}

      {/* Bank account */}
      {me.bankAccount && (
        <div className="card">
          <div className="card-title">🏦 บัญชีรับโอน</div>
          <div className="row">
            <span className="label">ธนาคาร</span>
            <span className="value">{me.bankAccount.bankName}</span>
          </div>
          <div className="row">
            <span className="label">เลขบัญชี</span>
            <span className="value accent">{me.bankAccount.accountNumber}</span>
          </div>
          <div className="row">
            <span className="label">ชื่อบัญชี</span>
            <span className="value">{me.bankAccount.accountName}</span>
          </div>
        </div>
      )}

      {/* Contact info */}
      {me.room && (
        <div className="card">
          <div className="card-title">ข้อมูลห้องพัก</div>
          <div className="row">
            <span className="label">ห้อง</span>
            <span className="value">{me.room.roomNumber}</span>
          </div>
          <div className="row">
            <span className="label">ค่าเช่า/เดือน</span>
            <span className="value">฿{fmt(me.room.monthlyRent)}</span>
          </div>
          {me.billDueDay && (
            <div className="row">
              <span className="label">กำหนดชำระทุกวันที่</span>
              <span className="value">{me.billDueDay}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
