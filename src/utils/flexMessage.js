/**
 * Build a beautiful Line Flex Message for an invoice.
 * Displays a full breakdown of all InvoiceItems.
 */
function buildInvoiceFlexMessage(invoice, dormName = 'หอพัก') {
  const { contract, items, month, year, totalAmount, dueDate, status } = invoice;
  const { tenant, room } = contract;

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthTh  = monthNames[month - 1];
  const yearThai = year + 543;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // ---- Item rows ----
  const itemRows = items.map(item => {
    let subText = '';
    if (item.billingType === 'METER' && item.previousMeter !== null) {
      subText = `(${item.previousMeter}→${item.currentMeter} = ${item.unitUsed} หน่วย × ฿${item.unitRate})`;
    }

    return {
      type: 'box',
      layout: 'vertical',
      margin: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: item.label, size: 'sm', color: '#333333', flex: 3, wrap: true },
            { type: 'text', text: `฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
              size: 'sm', color: '#1e40af', align: 'end', flex: 2, weight: 'bold' },
          ],
        },
        ...(subText ? [{
          type: 'text', text: subText, size: 'xxs', color: '#888888', margin: 'xs', wrap: true,
        }] : []),
      ],
    };
  });

  return {
    type: 'flex',
    altText: `แจ้งค่าใช้จ่ายห้อง ${room.roomNumber} เดือน ${monthTh} ${yearThai}`,
    contents: {
      type: 'bubble',
      size: 'kilo',

      // ---- HEADER ----
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1e40af',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text', text: `🏠 ${dormName}`, color: '#ffffff', size: 'lg',
                weight: 'bold', flex: 1, wrap: true,
              },
              {
                type: 'text', text: `ห้อง ${room.roomNumber}`, color: '#93c5fd',
                size: 'lg', weight: 'bold', align: 'end', flex: 1, wrap: true,
              },
            ],
          },
          {
            type: 'text',
            text: `ใบแจ้งค่าใช้จ่าย ${monthTh} ${yearThai}`,
            color: '#bfdbfe', size: 'sm', margin: 'md',
          },
          {
            type: 'text', text: `ถึง: ${tenant.name}`, color: '#dbeafe', size: 'xs', margin: 'sm',
          },
        ],
      },

      // ---- BODY ----
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          // Section title
          {
            type: 'text', text: 'รายละเอียดค่าใช้จ่าย', size: 'sm',
            color: '#6b7280', weight: 'bold', margin: 'none',
          },
          { type: 'separator', margin: 'sm', color: '#e5e7eb' },

          // Items
          ...itemRows,

          // Divider before total
          { type: 'separator', margin: 'md', color: '#e5e7eb' },

          // Total row
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: 'ยอดรวมทั้งหมด', size: 'md', weight: 'bold', color: '#111827', flex: 1 },
              {
                type: 'text',
                text: `฿${Number(totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                size: 'lg', weight: 'bold', color: '#1e40af', align: 'end', flex: 1, wrap: true,
              },
            ],
          },

          // Due date
          ...(dueDateStr ? [{
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: 'กำหนดชำระ', size: 'xs', color: '#9ca3af', flex: 3 },
              { type: 'text', text: dueDateStr, size: 'xs', color: '#dc2626', align: 'end', flex: 2, weight: 'bold' },
            ],
          }] : []),
        ],
      },

      // ---- FOOTER ----
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#f0f9ff',
        paddingAll: '14px',
        contents: [
          {
            type: 'text',
            text: '📎 กรุณาส่งสลิปการโอนเงินในแชทนี้',
            size: 'sm', color: '#1e40af', weight: 'bold', align: 'center', wrap: true,
          },
          {
            type: 'text',
            text: 'ระบบจะรับทราบโดยอัตโนมัติ',
            size: 'xs', color: '#6b7280', align: 'center', margin: 'xs',
          },
        ],
      },

      styles: {
        header: { separator: false },
        body:   { separator: false },
        footer: { separator: true, separatorColor: '#dbeafe' },
      },
    },
  };
}

module.exports = { buildInvoiceFlexMessage };
