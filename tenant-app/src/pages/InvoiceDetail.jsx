import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

const MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmt(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

function Toast({ msg, type }) {
  return <div className={`toast ${type}`}>{msg}</div>;
}

export default function InvoiceDetail() {
  const { id }            = useParams();
  const nav               = useNavigate();
  const fileRef           = useRef();
  const [inv, setInv]     = useState(null);
  const [preview, setPreview] = useState('');
  const [file, setFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInvoice(id).then(setInv).catch(e => setError(e.message));
  }, [id]);

  function showToast(msg, type = 'green') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadSlip(id, file);
      showToast('✅ ส่งสลิปสำเร็จ');
      // reload invoice
      const updated = await api.getInvoice(id);
      setInv(updated);
      setFile(null);
      setPreview('');
    } catch (e) {
      showToast('❌ ' + e.message, 'red');
    } finally {
      setUploading(false);
    }
  }

  if (error) return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => nav('/invoices')}>← กลับ</button>
        <h1>รายละเอียดบิล</h1>
      </div>
      <div className="card" style={{ color: '#dc2626' }}>{error}</div>
    </div>
  );

  if (!inv) return (
    <div className="center-msg"><p className="sub">กำลังโหลด...</p></div>
  );

  const isPending = inv.status === 'PENDING';
  const isReview  = inv.status === 'REVIEW';

  return (
    <div className="page">
      {toast && <Toast {...toast} />}

      <div className="page-header">
        <button className="back-btn" onClick={() => nav('/invoices')}>← กลับ</button>
        <h1>บิล {MONTHS[inv.month]} {inv.year + 543}</h1>
      </div>

      {/* Summary */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="amount-big">฿{fmt(inv.totalAmount)}</div>
        <div className="amount-label">
          {isPending && <span className="badge pending">รอชำระ</span>}
          {isReview  && <span className="badge review">รอตรวจสอบสลิป</span>}
          {inv.status === 'PAID' && <span className="badge paid">ชำระแล้ว ✅</span>}
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
      </div>

      {/* Upload slip */}
      {isPending && (
        <div className="card">
          <div className="card-title">แนบสลิปการโอน</div>
          <div className="upload-area" onClick={() => fileRef.current.click()}>
            {preview
              ? <img src={preview} alt="slip preview" />
              : <><p style={{ fontSize: 32 }}>📎</p><p style={{ marginTop: 8 }}>แตะเพื่อเลือกรูปสลิป</p></>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
          {file && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? '⏳ กำลังส่ง...' : '✅ ยืนยันส่งสลิป'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setFile(null); setPreview(''); }}>
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      )}

      {/* Review state */}
      {isReview && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 32 }}>🕐</p>
          <p style={{ fontWeight: 700, marginTop: 8 }}>ส่งสลิปแล้ว รอตรวจสอบ</p>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>เจ้าของหอจะยืนยันภายใน 24 ชม.</p>
          {inv.slipPath && (
            <img src={inv.slipPath} alt="slip" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', marginTop: 12, borderRadius: 8 }} />
          )}
        </div>
      )}

      {/* Paid state */}
      {inv.status === 'PAID' && inv.paidAt && (
        <div className="card">
          <div className="row">
            <span className="label">ชำระเมื่อ</span>
            <span className="value green">
              {new Date(inv.paidAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
