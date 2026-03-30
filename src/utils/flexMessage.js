/**
 * Build a LINE Flex Message for an invoice.
 * Supports 4 styles: classic, receipt, minimal, bold
 *
 * @param {object} invoice   - Invoice with items, contract, etc.
 * @param {string} dormName  - Property name
 * @param {object} theme     - { style, headerColor, accentColor }
 */
function buildInvoiceFlexMessage(invoice, dormName = 'หอพัก', theme = {}) {
  const style       = theme.style       || 'classic';
  const headerColor = theme.headerColor || '#1e40af';
  const accentColor = theme.accentColor || '#1e40af';

  const { contract, items, month, year, totalAmount, dueDate } = invoice;
  const { tenant, room } = contract;

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthTh  = monthNames[month - 1];
  const yearThai = year + 543;
  const totalStr = `฿${Number(totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const altText = `แจ้งค่าใช้จ่ายห้อง ${room.roomNumber} เดือน ${monthTh} ${yearThai}`;

  // ── Shared helpers ─────────────────────────────────────────────
  const itemRows = (labelColor = '#333333', amountColor = null) =>
    items.map(item => {
      const subText = item.billingType === 'METER' && item.previousMeter !== null
        ? `(${item.previousMeter}→${item.currentMeter} = ${item.unitUsed} หน่วย × ฿${item.unitRate})`
        : null;
      return {
        type: 'box', layout: 'vertical', margin: 'sm',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: item.label, size: 'sm', color: labelColor, flex: 3, wrap: true },
              { type: 'text',
                text: `฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                size: 'sm', color: amountColor || accentColor, align: 'end', flex: 2, weight: 'bold' },
            ],
          },
          ...(subText ? [{ type: 'text', text: subText, size: 'xxs', color: '#888888', margin: 'xs', wrap: true }] : []),
        ],
      };
    });

  const dueDateRow = (textColor = '#dc2626') => dueDateStr ? [{
    type: 'box', layout: 'horizontal', margin: 'sm',
    contents: [
      { type: 'text', text: 'กำหนดชำระ', size: 'xs', color: '#9ca3af', flex: 3 },
      { type: 'text', text: dueDateStr, size: 'xs', color: textColor, align: 'end', flex: 2, weight: 'bold' },
    ],
  }] : [];

  const bankAccount = tenant.bankAccount;
  const bankAccountRows = () => bankAccount ? [
    { type: 'separator', margin: 'md', color: '#e5e7eb' },
    { type: 'text', text: '🏦 โอนเข้าบัญชี', size: 'xs', color: '#6b7280', weight: 'bold', margin: 'md' },
    { type: 'text', text: `ธนาคาร${bankAccount.bankName}`, size: 'sm', color: '#111827', margin: 'xs' },
    { type: 'text', text: bankAccount.accountNumber, size: 'sm', color: '#111827', weight: 'bold' },
    { type: 'text', text: `ชื่อ: ${bankAccount.accountName}`, size: 'xs', color: '#6b7280' },
  ] : [];

  // ── Build by style ──────────────────────────────────────────────
  let bubble;

  if (style === 'receipt') {
    bubble = buildReceipt({ dormName, room, tenant, monthTh, yearThai, totalStr, dueDateStr, items, itemRows, accentColor, dueDateRow, bankAccountRows });
  } else if (style === 'minimal') {
    bubble = buildMinimal({ dormName, room, tenant, monthTh, yearThai, totalStr, items, itemRows, accentColor, dueDateRow, bankAccountRows });
  } else if (style === 'bold') {
    bubble = buildBold({ dormName, room, tenant, monthTh, yearThai, totalStr, items, headerColor, accentColor, dueDateRow, bankAccountRows });
  } else {
    bubble = buildClassic({ dormName, room, tenant, monthTh, yearThai, totalStr, items, itemRows, headerColor, accentColor, dueDateRow, bankAccountRows });
  }

  return { type: 'flex', altText, contents: bubble };
}

// ─────────────────────────────────────────────────────────────────
// CLASSIC  (header สี + รายการ + footer)
// ─────────────────────────────────────────────────────────────────
function buildClassic({ dormName, room, tenant, monthTh, yearThai, totalStr, itemRows, headerColor, accentColor, dueDateRow, bankAccountRows }) {
  const lightHeader = lighten(headerColor);
  return {
    type: 'bubble', size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: headerColor, paddingAll: '20px',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: `🏠 ${dormName}`, color: '#ffffff', size: 'md', weight: 'bold', flex: 1, wrap: true },
          { type: 'text', text: `ห้อง ${room.roomNumber}`, color: '#93c5fd', size: 'md', weight: 'bold', align: 'end', flex: 1, wrap: true },
        ]},
        { type: 'text', text: `ใบแจ้งค่าใช้จ่าย ${monthTh} ${yearThai}`, color: '#bfdbfe', size: 'sm', margin: 'md' },
        { type: 'text', text: `ถึง: ${tenant.name}`, color: '#dbeafe', size: 'xs', margin: 'sm' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '16px',
      contents: [
        { type: 'text', text: 'รายละเอียดค่าใช้จ่าย', size: 'sm', color: '#6b7280', weight: 'bold' },
        { type: 'separator', margin: 'sm', color: '#e5e7eb' },
        ...itemRows(),
        { type: 'separator', margin: 'md', color: '#e5e7eb' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'text', text: 'ยอดรวมทั้งหมด', size: 'sm', weight: 'bold', color: '#111827', flex: 1 },
          { type: 'text', text: totalStr, size: 'md', weight: 'bold', color: accentColor, align: 'end', flex: 1, wrap: true },
        ]},
        ...dueDateRow(),
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', backgroundColor: lightHeader, paddingAll: '14px',
      contents: [
        ...bankAccountRows(),
        { type: 'text', text: '📎 ส่งสลิปการโอนเงินในแชทนี้ได้เลย', size: 'sm', color: accentColor, weight: 'bold', align: 'center', wrap: true, margin: bankAccountRows().length ? 'md' : 'none' },
        { type: 'text', text: 'ระบบตอบกลับโดยอัตโนมัติ', size: 'xs', color: '#6b7280', align: 'center', margin: 'xs' },
      ],
    },
    styles: { footer: { separator: true, separatorColor: '#dbeafe' } },
  };
}

// ─────────────────────────────────────────────────────────────────
// RECEIPT  (สไตล์ใบเสร็จ เส้นประ)
// ─────────────────────────────────────────────────────────────────
function buildReceipt({ dormName, room, tenant, monthTh, yearThai, totalStr, items, accentColor, dueDateRow, bankAccountRows }) {
  const itemBoxes = items.map(item => ({
    type: 'box', layout: 'horizontal', margin: 'sm',
    contents: [
      { type: 'text', text: item.label, size: 'sm', color: '#444444', flex: 3 },
      { type: 'text',
        text: `฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        size: 'sm', color: '#222222', align: 'end', flex: 2, weight: 'bold' },
    ],
  }));

  return {
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', backgroundColor: '#fafafa', paddingAll: '16px',
      contents: [
        // Header zone
        { type: 'text', text: `🏠 ${dormName}`, size: 'lg', weight: 'bold', color: '#111827', align: 'center' },
        { type: 'text', text: `ใบแจ้งหนี้ ${monthTh} ${yearThai}`, size: 'sm', color: '#6b7280', align: 'center', margin: 'xs' },
        // Dashed separator
        { type: 'text', text: '- - - - - - - - - - - - - - - - -', size: 'xxs', color: '#cccccc', align: 'center', margin: 'sm' },
        // Room & tenant
        { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
          { type: 'text', text: 'ห้อง', size: 'sm', color: '#9ca3af', flex: 2 },
          { type: 'text', text: room.roomNumber, size: 'sm', color: '#111827', weight: 'bold', align: 'end', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ผู้เช่า', size: 'sm', color: '#9ca3af', flex: 2 },
          { type: 'text', text: tenant.name, size: 'sm', color: '#111827', align: 'end', flex: 3, wrap: true },
        ]},
        { type: 'text', text: '- - - - - - - - - - - - - - - - -', size: 'xxs', color: '#cccccc', align: 'center', margin: 'sm' },
        // Items
        ...itemBoxes,
        // Double line
        { type: 'text', text: '═══════════════════════', size: 'xxs', color: '#aaaaaa', align: 'center', margin: 'md' },
        // Total
        { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
          { type: 'text', text: 'ยอดรวม', size: 'md', weight: 'bold', color: '#111827', flex: 2 },
          { type: 'text', text: totalStr, size: 'xl', weight: 'bold', color: accentColor, align: 'end', flex: 3 },
        ]},
        ...dueDateRow('#dc2626'),
        { type: 'text', text: '- - - - - - - - - - - - - - - - -', size: 'xxs', color: '#cccccc', align: 'center', margin: 'sm' },
        // Bank account
        ...bankAccountRows(),
        // Footer
        { type: 'text', text: '📎 ส่งสลิปในแชทนี้ได้เลย', size: 'sm', color: accentColor, align: 'center', weight: 'bold', margin: 'sm' },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// MINIMAL  (เรียบ ตัวเลขใหญ่)
// ─────────────────────────────────────────────────────────────────
function buildMinimal({ dormName, room, tenant, monthTh, yearThai, totalStr, items, itemRows, accentColor, dueDateRow, bankAccountRows }) {
  return {
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', paddingAll: '24px', spacing: 'md',
      contents: [
        // Property name
        { type: 'text', text: dormName, size: 'sm', color: '#9ca3af', weight: 'bold' },
        // Big amount
        { type: 'text', text: totalStr, size: 'xxl', weight: 'bold', color: accentColor, margin: 'sm' },
        { type: 'text', text: `ค่าใช้จ่ายห้อง ${room.roomNumber} · ${monthTh} ${yearThai}`, size: 'xs', color: '#6b7280' },
        // Thin separator
        { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#e5e7eb', margin: 'lg', contents: [] },
        // Items compact
        ...itemRows('#4b5563', '#111827'),
        ...dueDateRow(),
        // Separator
        { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#e5e7eb', margin: 'lg', contents: [] },
        // Bank account + CTA
        ...bankAccountRows(),
        { type: 'text', text: `ถึง: ${tenant.name}`, size: 'xs', color: '#9ca3af', margin: bankAccountRows().length ? 'md' : 'none' },
        { type: 'text', text: '💳 ส่งสลิปโอนเงินในแชทนี้', size: 'sm', color: accentColor, weight: 'bold', margin: 'xs' },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// BOLD / MODERN  (header เข้ม ตัวเลขโดด)
// ─────────────────────────────────────────────────────────────────
function buildBold({ dormName, room, tenant, monthTh, yearThai, totalStr, items, headerColor, accentColor, dueDateRow, bankAccountRows }) {
  const chips = items.map(item => ({
    type: 'box', layout: 'vertical', flex: 1,
    backgroundColor: '#f3f4f6', cornerRadius: '8px', paddingAll: '8px',
    contents: [
      { type: 'text', text: item.label, size: 'xxs', color: '#6b7280', align: 'center' },
      { type: 'text',
        text: `฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 0 })}`,
        size: 'sm', weight: 'bold', color: '#111827', align: 'center' },
    ],
  }));

  // กรณีมีมากกว่า 3 items ให้แสดงแถว 2 แถว
  const chipRows = [];
  for (let i = 0; i < chips.length; i += 3) {
    chipRows.push({
      type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
      contents: chips.slice(i, i + 3),
    });
  }

  return {
    type: 'bubble', size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: headerColor, paddingAll: '20px',
      contents: [
        { type: 'text', text: `🏠  ${dormName}`, color: '#ffffff', size: 'lg', weight: 'bold' },
        { type: 'text', text: `${monthTh} ${yearThai}  ·  ห้อง ${room.roomNumber}`, color: '#ffffffb3', size: 'sm', margin: 'sm' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
      contents: [
        // Big total
        { type: 'text', text: 'ยอดที่ต้องชำระ', size: 'xs', color: '#9ca3af', weight: 'bold' },
        { type: 'text', text: totalStr, size: 'xxl', weight: 'bold', color: accentColor },
        { type: 'text', text: `ถึง: ${tenant.name}`, size: 'xs', color: '#9ca3af', margin: 'xs' },
        ...dueDateRow(),
        // Chip grid
        { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#e5e7eb', margin: 'md', contents: [] },
        ...chipRows,
        // CTA
        { type: 'box', layout: 'vertical', height: '1px', backgroundColor: '#e5e7eb', margin: 'md', contents: [] },
        ...bankAccountRows(),
        { type: 'text', text: '📎 ส่งสลิปการโอนเงินในแชทนี้ได้เลย', size: 'sm', color: accentColor, weight: 'bold', align: 'center', wrap: true, margin: bankAccountRows().length ? 'md' : 'none' },
        { type: 'text', text: 'ระบบตอบกลับโดยอัตโนมัติ', size: 'xs', color: '#6b7280', align: 'center', margin: 'xs' },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Utility: lighten a hex color for backgrounds
// ─────────────────────────────────────────────────────────────────
function lighten(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, r + Math.round((255 - r) * 0.88));
    const lg = Math.min(255, g + Math.round((255 - g) * 0.88));
    const lb = Math.min(255, b + Math.round((255 - b) * 0.88));
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  } catch { return '#f0f9ff'; }
}

module.exports = { buildInvoiceFlexMessage };
