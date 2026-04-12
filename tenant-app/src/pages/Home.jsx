import { useEffect, useRef, useState } from 'react';
import { C, Tag, Card, Pill, Btn } from '../components';
import { api, getToken, getPid } from '../lib/api';

// ── SVG Icons ─────────────────────────────────────────────────────
const Icon = {
  Home: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Pin:  () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Bank: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  Drop: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  Clip: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Msg:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Cam:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

function SafeImage({ src, style }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!src) return;
    fetch(src, { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.blob()).then(b => setUrl(URL.createObjectURL(b))).catch(() => {});
  }, [src]);
  return url ? <img src={url} style={style} /> : null;
}

const ST_LABEL = { OPEN:'รอดำเนินการ', IN_PROGRESS:'กำลังซ่อม', DONE:'เสร็จแล้ว', REJECTED:'ปฏิเสธ' };
const ST_COLOR = { OPEN: C.warn, IN_PROGRESS: C.info, DONE: C.accent, REJECTED: C.danger };

const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function fmt(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 }); }

function statusMeta(s) {
  if (s === 'PENDING') return { label: 'รอชำระ',      color: C.warn    };
  if (s === 'REVIEW')  return { label: 'รอตรวจสอบ',   color: C.info    };
  return                      { label: 'ชำระแล้ว ✓',  color: C.accent  };
}

// ── Upload Slip modal ────────────────────────────────────────────
function SlipModal({ invoiceId, onClose, onDone, uploadFn }) {
  const fileRef   = useRef();
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  function onPick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setErr('');
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setLoading(true); setErr('');
    try {
      await (uploadFn ? uploadFn(invoiceId, file) : api.uploadSlip(invoiceId, file));
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000CC', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', padding: 20, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>อัปโหลดสลิป</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div
          onClick={() => fileRef.current.click()}
          style={{ border: `2px dashed ${file ? C.accent : C.cardBorder}`, borderRadius: 14, padding: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
        >
          {preview
            ? <img src={preview} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, objectFit: 'contain' }} />
            : <><div style={{ fontSize: 36, color: C.muted }}><Icon.Clip /></div><div style={{ color: C.muted, marginTop: 8, fontSize: 13 }}>แตะเพื่อเลือกรูปสลิป</div></>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} />
        {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Btn color={C.accent} onClick={submit} disabled={!file || loading}>
            {loading ? '⏳ กำลังส่ง...' : '✓ ยืนยันส่งสลิป'}
          </Btn>
          <Btn color={C.muted} outline onClick={onClose}>ยกเลิก</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Water Tab ────────────────────────────────────────────────────
function WaterTab({ prices, qty, note, payLater, orders, submitting, onMount, onChange, onPayLater, onSubmit, onSlip }) {
  useEffect(() => { onMount(); }, []);
  const total = prices ? (qty.small * prices.smallPrice) + (qty.large * prices.largePrice) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Drop /> สั่งน้ำดื่ม</div>
        {!prices ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: 16 }}>กำลังโหลด...</div>
        ) : (
          <>
            {[
              { key: 'small', label: prices.smallLabel, price: prices.smallPrice },
              { key: 'large', label: prices.largeLabel, price: prices.largePrice },
            ].map(({ key, label, price }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 12, color: C.accent }}>฿{price} / แพ็ค</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => onChange(key, Math.max(0, (qty[key] || 0) - 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, background: C.cardBorder, border: 'none', color: C.text, fontSize: 18, cursor: 'pointer' }}>−</button>
                  <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: 'center' }}>{qty[key] || 0}</span>
                  <button onClick={() => onChange(key, (qty[key] || 0) + 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, border: 'none', color: '#0F0F13', fontSize: 18, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}
            <input
              placeholder="หมายเหตุ เช่น ฝากไว้หน้าห้อง (ไม่บังคับ)"
              value={note} onChange={e => onChange('note', e.target.value)}
              style={{ marginTop: 10, background: '#0F0F13', border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontFamily: 'inherit', fontSize: 13, width: '100%' }}
            />
            {/* checkbox ติดไว้สิ้นเดือน */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13, color: C.muted }}>
              <input type="checkbox" checked={payLater} onChange={e => onPayLater(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: C.accent }} />
              ติดไว้ก่อนจ่ายสิ้นเดือน 😂
            </label>
            {total > 0 && (
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: C.muted }}>
                รวม <span style={{ fontWeight: 800, fontSize: 18, color: C.accent }}>฿{total}</span>
              </div>
            )}
            <Btn color={C.accent} onClick={onSubmit} disabled={submitting || (!qty.small && !qty.large)} style={{ marginTop: 10 }}>
              {submitting ? 'กำลังส่ง...' : <span style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}><Icon.Drop /> สั่งน้ำดื่ม</span>}
            </Btn>
            {/* bank account */}
            {!payLater && prices.bankAccount && (
              <div style={{ marginTop: 12, background: '#0F0F13', borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.cardBorder}`, fontSize: 13 }}>
                <div style={{ color: C.muted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Bank /> โอนเงินมาที่</div>
                <div style={{ fontWeight: 700 }}>{prices.bankAccount.bankName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{ fontFamily: 'monospace', color: C.accent }}>{prices.bankAccount.accountNumber}</span>
                  <button onClick={() => navigator.clipboard.writeText(prices.bankAccount.accountNumber).then(() => alert('✅ คัดลอกแล้ว'))}
                    style={{ fontSize: 11, background: C.accent, color: '#0F0F13', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 }}>copy</button>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{prices.bankAccount.accountName}</div>
              </div>
            )}
          </>
        )}
      </Card>
      {orders.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>ประวัติการสั่ง</div>
          {orders.map(o => (
            <div key={o.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.cardBorder}`, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {o.smallPacks > 0 && <span style={{ marginRight: 8 }}>เล็ก x{o.smallPacks}</span>}
                  {o.largePacks > 0 && <span>ใหญ่ x{o.largePacks}</span>}
                  <div style={{ fontSize: 11, color: C.muted }}>{new Date(o.saleDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: C.accent }}>฿{Number(o.totalAmount).toFixed(0)}</div>
                  <div style={{ fontSize: 11, color: o.isPaid ? C.accent : C.warn }}>{o.isPaid ? 'ชำระแล้ว' : 'รอชำระ'}</div>
                  {!o.isPaid && (
                    <button onClick={() => onSlip(o.id)}
                      style={{ marginTop: 4, fontSize: 11, background: C.accent, color: '#0F0F13', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>
                      📎 แนบสลิป
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]           = useState('overview');
  const [me, setMe]             = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [repairs, setRepairs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadErr, setLoadErr]   = useState('');
  const [slipModal, setSlipModal]   = useState(null);
  const [repairForm, setRepairForm] = useState(false);
  const [repairData, setRepairData] = useState({ title: '', description: '', priority: 'NORMAL' });
  const [repairFile, setRepairFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const repairFileRef = useRef();

  const [waterPrices, setWaterPrices]   = useState(null);
  const [waterQty, setWaterQty]         = useState({ small: 0, large: 0 });
  const [waterNote, setWaterNote]       = useState('');
  const [waterPayLater, setWaterPayLater] = useState(false);
  const [waterOrders, setWaterOrders]   = useState([]);
  const [waterSubmit, setWaterSubmit]   = useState(false);
  const [waterSlipModal, setWaterSlipModal] = useState(null);
  const [toast, setToast]               = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const [meData, invData, repData] = await Promise.all([
        api.getMe(),
        api.listInvoices().catch(() => []),
        api.listRepairs().catch(() => []),
      ]);
      setMe(meData);
      setInvoices(Array.isArray(invData) ? invData : []);
      setRepairs(Array.isArray(repData) ? repData : []);
    } catch (e) {
      setLoadErr(e.message || String(e));
    }
    setLoading(false);
  }

  async function submitRepair() {
    if (!repairData.title.trim()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', repairData.title.trim());
      fd.append('description', repairData.description);
      fd.append('priority', repairData.priority);
      if (repairFile) fd.append('image', repairFile);
      await api.createRepair(fd);
      setRepairForm(false);
      setRepairData({ title: '', description: '', priority: 'NORMAL' });
      setRepairFile(null);
      const repData = await api.listRepairs();
      setRepairs(repData);
    } catch (e) { showToast('❌ ' + e.message); }
    setSubmitting(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: C.muted }}>กำลังโหลด...</div>
  );

  if (!me) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 8, padding: 32, textAlign: 'center', background: C.bg, color: C.text }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <div style={{ fontWeight: 700 }}>ไม่พบข้อมูลผู้เช่า</div>
      <div style={{ fontSize: 13, color: C.muted }}>กรุณาติดต่อเจ้าของหอพัก</div>
      {loadErr && <div style={{ fontSize: 11, color: C.danger, marginTop: 8, wordBreak: 'break-all' }}>{loadErr}</div>}
    </div>
  );

  const currentInv = invoices.find(i => i.status === 'PENDING') || invoices[0] || null;
  const unpaidAmt  = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.totalAmount), 0);

  // contract expiry days
  const endDate   = me.contract?.endDate ? new Date(me.contract.endDate) : null;
  const daysLeft  = endDate ? Math.ceil((endDate - Date.now()) / 86400000) : null;

  return (
    <div style={{ fontFamily: "'Sarabun', sans-serif", background: C.bg, minHeight: '100dvh', color: C.text, paddingBottom: 80 }}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {slipModal && (
        <SlipModal invoiceId={slipModal} onClose={() => setSlipModal(null)} onDone={() => { setSlipModal(null); load(); }} />
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D2E22 0%, #0F0F13 60%)', padding: '24px 20px 16px', borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Home /> RENTMATE</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{['สวัสดี','หวัดดี','ว่าไง','เป็นไงบ้าง','ยินดีต้อนรับ'][Math.floor(Date.now() / 60000) % 5]}, {me.nickname || me.name} 👋</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Icon.Pin /> {me.room?.roomNumber ?? 'ยังไม่มีห้อง'}</div>
          </div>
          <div style={{ background: C.line, borderRadius: 12, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#fff' }}>LINE</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <Card style={{ padding: '12px 14px' }} glow={unpaidAmt > 0 ? C.warn : undefined}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ยอดค้างชำระ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: unpaidAmt > 0 ? C.warn : C.accent }}>
              {unpaidAmt > 0 ? `฿${fmt(unpaidAmt)}` : '✓ ชำระแล้ว'}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {currentInv?.dueDate ? `ครบ ${new Date(currentInv.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : 'ไม่มีบิลค้าง'}
            </div>
          </Card>
          <Card style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ห้อง {me.room?.roomNumber ?? '—'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: daysLeft != null && daysLeft <= 30 ? C.warn : C.accent }}>
              {endDate ? endDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : 'ไม่กำหนด'}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {daysLeft != null ? `เหลืออีก ${daysLeft} วัน` : 'ไม่มีวันสิ้นสุด'}
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', overflowX: 'auto' }}>
        {[['overview','ภาพรวม'],['bills','บิล'],['repair','แจ้งซ่อม'],['water','น้ำดื่ม'],['docs','เอกสาร']].map(([k, l]) => (
          <Pill key={k} label={l} active={tab === k} onClick={() => {
            setTab(k);
            if (k === 'repair') api.listRepairs().then(d => setRepairs(Array.isArray(d) ? d : [])).catch(() => {});
          }} />
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Current bill highlight */}
            {currentInv && (
              <Card glow={currentInv.status === 'PENDING' ? C.warn : C.accent}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>บิล {MONTHS[currentInv.month]} {currentInv.year + 543}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: statusMeta(currentInv.status).color, marginTop: 2 }}>
                      ฿{fmt(currentInv.totalAmount)}
                    </div>
                  </div>
                  <Tag color={statusMeta(currentInv.status).color}>{statusMeta(currentInv.status).label}</Tag>
                </div>
                {currentInv.status === 'PENDING' && (
                  <Btn color={C.accent} onClick={() => setSlipModal(currentInv.id)} style={{ marginTop: 12 }}>
                    <span style={{display:'flex',alignItems:'center',gap:5}}><Icon.Clip /> อัปโหลดสลิปชำระเงิน</span>
                  </Btn>
                )}
              </Card>
            )}

            {/* Bank account */}
            {me.bankAccount && (
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Icon.Bank /> บัญชีรับโอน</div>
                {[
                  ['ธนาคาร',  me.bankAccount.bankName, false],
                  ['เลขบัญชี', me.bankAccount.accountNumber, true],
                  ['ชื่อบัญชี', me.bankAccount.accountName, false],
                ].map(([l, v, canCopy]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: canCopy ? C.accent : C.text }}>{v}</span>
                      {canCopy && (
                        <button
                          onClick={() => navigator.clipboard.writeText(v).then(() => showToast('✅ คัดลอกแล้ว'))}
                          style={{ background: C.accentDim, border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 700 }}
                        >copy</button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ── Bills ── */}
        {tab === 'bills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {invoices.length === 0 && (
              <Card><div style={{ textAlign: 'center', color: C.muted, padding: 20 }}>ยังไม่มีใบแจ้งหนี้</div></Card>
            )}
            {invoices.map(inv => {
              const st = statusMeta(inv.status);
              return (
                <Card key={inv.id} glow={inv.status === 'PENDING' ? C.warn : undefined}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>บิล {MONTHS[inv.month]} {inv.year + 543}</div>
                      {inv.dueDate && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>ครบกำหนด {new Date(inv.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: st.color }}>฿{fmt(inv.totalAmount)}</div>
                      <Tag color={st.color}>{st.label}</Tag>
                    </div>
                  </div>
                  {inv.status === 'PENDING' && (
                    <Btn color={C.accent} onClick={() => setSlipModal(inv.id)} style={{ marginTop: 10 }}>
                      อัปโหลดสลิปชำระเงิน
                    </Btn>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Repair ── */}
        {tab === 'repair' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* New repair form */}
            {repairForm ? (
              <Card>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>แจ้งซ่อมใหม่</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    placeholder="หัวข้อ เช่น แอร์ไม่เย็น *"
                    value={repairData.title}
                    onChange={e => setRepairData(p => ({ ...p, title: e.target.value }))}
                    style={{ background: '#0F0F13', border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14 }}
                  />
                  <textarea
                    placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                    rows={3}
                    value={repairData.description}
                    onChange={e => setRepairData(p => ({ ...p, description: e.target.value }))}
                    style={{ background: '#0F0F13', border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14, resize: 'none' }}
                  />
                  <select
                    value={repairData.priority}
                    onChange={e => setRepairData(p => ({ ...p, priority: e.target.value }))}
                    style={{ background: '#0F0F13', border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '10px 12px', color: C.text, fontFamily: 'inherit', fontSize: 14 }}
                  >
                    <option value="HIGH">🔴 ด่วนมาก</option>
                    <option value="NORMAL">🟡 ปกติ</option>
                    <option value="LOW">⚪ ไม่ด่วน</option>
                  </select>
                  <div
                    onClick={() => repairFileRef.current.click()}
                    style={{ border: `2px dashed ${repairFile ? C.accent : C.cardBorder}`, borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', color: C.muted, fontSize: 13 }}
                  >
                    {repairFile ? <span style={{display:'flex',alignItems:'center',gap:5}}><Icon.Clip />{repairFile.name}</span> : <span style={{display:'flex',alignItems:'center',gap:5}}><Icon.Cam /> แนบรูป (ไม่บังคับ)</span>}
                  </div>
                  <input ref={repairFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setRepairFile(e.target.files[0] || null)} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Btn color={C.accent} onClick={submitRepair} disabled={!repairData.title.trim() || submitting}>
                      {submitting ? '⏳...' : '✓ ส่งแจ้งซ่อม'}
                    </Btn>
                    <Btn color={C.muted} outline onClick={() => setRepairForm(false)}>ยกเลิก</Btn>
                  </div>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setRepairForm(true)}
                style={{ width: '100%', background: C.accentDim, color: C.accent, border: `1px dashed ${C.accent}`, borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              >+ แจ้งซ่อมใหม่</button>
            )}

            {/* List */}
            {repairs.length === 0 && !repairForm && (
              <Card><div style={{ textAlign: 'center', color: C.muted, padding: 20 }}>ยังไม่มีรายการแจ้งซ่อม</div></Card>
            )}
            {repairs.map(r => (
              <Card key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{r.description}</div>}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {new Date(r.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <Tag color={ST_COLOR[r.status]}>{ST_LABEL[r.status]}</Tag>
                </div>
                {r.adminNote && (
                  <div style={{ background: '#0F0F13', borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 12, color: C.muted }}>
                    <span style={{display:'flex',alignItems:'center',gap:5}}><Icon.Msg />{r.adminNote}</span>
                  </div>
                )}
                {r.imagePath && <SafeImage src={window.location.origin + r.imagePath} style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 180, objectFit: 'cover' }} />}
              </Card>
            ))}
          </div>
        )}

        {/* ── Water ── */}
        {tab === 'water' && (<>
          <WaterTab
            prices={waterPrices} qty={waterQty} note={waterNote} payLater={waterPayLater} orders={waterOrders}
            submitting={waterSubmit}
            onMount={() => {
              api.waterPrices().then(setWaterPrices).catch(() => {});
              api.waterOrders().then(d => setWaterOrders(Array.isArray(d) ? d : [])).catch(() => {});
            }}
            onChange={(field, val) => field === 'note' ? setWaterNote(val) : setWaterQty(p => ({ ...p, [field]: val }))}
            onPayLater={setWaterPayLater}
            onSlip={setWaterSlipModal}
            onSubmit={async () => {
              if (!waterQty.small && !waterQty.large) return showToast('⚠️ กรุณาเลือกจำนวนน้ำ');
              setWaterSubmit(true);
              try {
                await api.orderWater({ smallPacks: waterQty.small, largePacks: waterQty.large, note: waterNote, payLater: waterPayLater });
                setWaterQty({ small: 0, large: 0 }); setWaterNote(''); setWaterPayLater(false);
                const orders = await api.waterOrders().catch(() => []);
                setWaterOrders(Array.isArray(orders) ? orders : []);
                showToast('✅ สั่งน้ำเรียบร้อย!');
              } catch (e) { showToast('❌ ' + e.message); }
              setWaterSubmit(false);
            }}
          />
          {waterSlipModal && (
            <SlipModal
              invoiceId={waterSlipModal}
              onClose={() => setWaterSlipModal(null)}
              onDone={async () => {
                setWaterSlipModal(null);
                const orders = await api.waterOrders().catch(() => []);
                setWaterOrders(Array.isArray(orders) ? orders : []);
                showToast('✅ ส่งสลิปสำเร็จ!');
              }}
              uploadFn={(id, file) => {
                const fd = new FormData();
                fd.append('slip', file);
                return fetch(`/api/liff/water/orders/${id}/slip`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${getToken()}`, 'x-property-id': getPid(), 'ngrok-skip-browser-warning': '1' },
                  body: fd,
                }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'อัปโหลดไม่สำเร็จ'); return d; });
              }}
            />
          )}
        </>)}

        {/* ── Docs (Phase 3) ── */}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {me.contract ? (
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>📋 สัญญาเช่า</div>
                {[
                  ['เริ่มสัญญา', me.contract.startDate ? new Date(me.contract.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'],
                  ['หมดสัญญา',  me.contract.endDate   ? new Date(me.contract.endDate  ).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </Card>
            ) : (
              <Card><div style={{ textAlign: 'center', color: C.muted, padding: 20 }}>ไม่พบสัญญาเช่า</div></Card>
            )}
            <Card glow={C.info}>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 32, color: C.muted, display:'flex', justifyContent:'center' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>เอกสาร PDF</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>อยู่ระหว่างพัฒนา เร็วๆ นี้</div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: 12, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', background: C.card, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 18px' }}>
        {[
          { key: 'overview', label: 'หน้าหลัก', icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          )},
          { key: 'bills', label: 'ชำระเงิน', icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          )},
          { key: 'repair', label: 'แจ้งซ่อม', icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          )},
          { key: 'water', label: 'น้ำดื่ม', icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          )},
          { key: 'docs', label: 'เอกสาร', icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          )},
        ].map(({ key, label, icon }) => {
          const active = tab === key;
          return (
            <div key={key} onClick={() => setTab(key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', padding: '4px 12px', borderRadius: 12, transition: 'background .15s', background: active ? `${C.accent}18` : 'transparent' }}>
              {icon(active)}
              <span style={{ fontSize: 10, color: active ? C.accent : C.muted, fontWeight: active ? 700 : 400 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
