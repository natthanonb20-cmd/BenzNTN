import { useEffect, useRef, useState } from 'react';
import { C, Tag, Card, Pill, Btn } from '../components';
import { api } from '../lib/api';

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
function SlipModal({ invoiceId, onClose, onDone }) {
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
      await api.uploadSlip(invoiceId, file);
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
            : <><div style={{ fontSize: 36 }}>📎</div><div style={{ color: C.muted, marginTop: 8, fontSize: 13 }}>แตะเพื่อเลือกรูปสลิป</div></>
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
    } catch (e) { alert('❌ ' + e.message); }
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
            <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>🏠 RENTMATE</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>สวัสดี, {me.nickname || me.name} 👋</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>ห้อง {me.room?.roomNumber ?? '—'}</div>
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
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>สัญญาเช่า</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>
              {daysLeft != null ? `${daysLeft} วัน` : '—'}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {endDate ? `หมด ${endDate.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}` : 'ไม่ระบุ'}
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 20px', overflowX: 'auto' }}>
        {[['overview','ภาพรวม'],['bills','บิล'],['repair','แจ้งซ่อม'],['docs','เอกสาร']].map(([k, l]) => (
          <Pill key={k} label={l} active={tab === k} onClick={() => setTab(k)} />
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
                    📎 อัปโหลดสลิปชำระเงิน
                  </Btn>
                )}
              </Card>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '💳', label: 'ชำระค่าเช่า',   color: C.accent, action: () => setTab('bills')  },
                { icon: '🔧', label: 'แจ้งซ่อม',      color: C.info,   action: () => setTab('repair') },
                { icon: '📄', label: 'ดูสัญญา',        color: C.warn,   action: () => setTab('docs')   },
                { icon: '📊', label: 'ประวัติบิล',     color: C.muted,  action: () => setTab('bills')  },
              ].map(({ icon, label, color, action }) => (
                <Card key={label} style={{ padding: 14, textAlign: 'center', cursor: 'pointer' }} onClick={action}>
                  <div style={{ fontSize: 26 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 6 }}>{label}</div>
                </Card>
              ))}
            </div>

            {/* Bank account */}
            {me.bankAccount && (
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>🏦 บัญชีรับโอน</div>
                {[
                  ['ธนาคาร',  me.bankAccount.bankName],
                  ['เลขบัญชี', me.bankAccount.accountNumber],
                  ['ชื่อบัญชี', me.bankAccount.accountName],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                    <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: l === 'เลขบัญชี' ? C.accent : C.text }}>{v}</span>
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
                    {repairFile ? `📎 ${repairFile.name}` : '📷 แนบรูป (ไม่บังคับ)'}
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
                    💬 {r.adminNote}
                  </div>
                )}
                {r.imagePath && <img src={r.imagePath} style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 180, objectFit: 'cover' }} />}
              </Card>
            ))}
          </div>
        )}

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
                <div style={{ fontSize: 32 }}>📄</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>เอกสาร PDF</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>อยู่ระหว่างพัฒนา เร็วๆ นี้</div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', background: C.card, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-around', padding: '10px 0 16px' }}>
        {[['🏠','หน้าหลัก','overview'],['💳','ชำระเงิน','bills'],['🔧','แจ้งซ่อม','repair'],['📄','เอกสาร','docs']].map(([ic, lb, t]) => (
          <div key={lb} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setTab(t)}>
            <div style={{ fontSize: 20 }}>{ic}</div>
            <div style={{ fontSize: 10, color: tab === t ? C.accent : C.muted, fontWeight: tab === t ? 700 : 400 }}>{lb}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
