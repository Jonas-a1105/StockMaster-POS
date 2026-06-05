export interface TicketLine {
  type: 'text' | 'barcode' | 'separator' | 'qrcode';
  content?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: 'normal' | 'double' | 'small';
  data?: string;
}

export interface TicketData {
  title: string;
  businessName: string;
  businessRIF?: string;
  ticketNumber: string;
  date: string;
  cashier: string;
  client?: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  iva: number;
  igtf?: number;
  total: number;
  paymentMethod: string;
  dolarRate?: number;
  footer?: string;
}

function formatLines(lines: TicketLine[]): string {
  return lines
    .map((l) => {
      switch (l.type) {
        case 'separator':
          return '─'.repeat(32);
        case 'text':
          return `${l.content || ''}`;
        default:
          return '';
      }
    })
    .join('\n');
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateTicketHTML(ticket: TicketData): string {
  const itemsHtml = ticket.items
    .map(
      (item) =>
        `<tr><td style="font-size:12px">${escapeHtml(item.name)}</td><td style="font-size:10px;text-align:center">${item.qty}</td><td style="font-size:10px;text-align:right">$${item.price.toFixed(2)}</td><td style="font-size:12px;text-align:right;font-weight:700">$${item.total.toFixed(2)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
  h1 { text-align: center; font-size: 18px; margin: 0 0 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; }
  .total-row td { font-weight: bold; font-size: 14px; padding-top: 6px; }
  .footer { text-align: center; font-size: 10px; margin-top: 10px; color: #666; }
</style></head><body>
  <h1>${escapeHtml(ticket.businessName)}</h1>
  ${ticket.businessRIF ? `<p class="center" style="font-size:10px">RIF: ${escapeHtml(ticket.businessRIF)}</p>` : ''}
  <p class="center" style="font-size:11px">Ticket N°: ${escapeHtml(ticket.ticketNumber)}<br>${escapeHtml(ticket.date)}</p>
  <p style="font-size:10px">Cajero: ${escapeHtml(ticket.cashier)}${ticket.client ? ` | Cliente: ${escapeHtml(ticket.client)}` : ''}</p>
  <div class="sep"></div>
  <table><thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead><tbody>
  ${itemsHtml}
  </tbody></table>
  <div class="sep"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">$${ticket.subtotal.toFixed(2)}</td></tr>
    <tr><td>IVA (16%)</td><td style="text-align:right">$${ticket.iva.toFixed(2)}</td></tr>
    ${ticket.igtf ? `<tr><td>IGTF 3%</td><td style="text-align:right">$${ticket.igtf.toFixed(2)}</td></tr>` : ''}
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${ticket.total.toFixed(2)}</td></tr>
  </table>
  ${ticket.dolarRate ? `<p class="center" style="font-size:10px">Tasa BCV: Bs. ${ticket.dolarRate}</p>` : ''}
  <p class="center" style="font-size:10px">Método de Pago: ${escapeHtml(ticket.paymentMethod)}</p>
  <div class="sep"></div>
  ${ticket.footer ? `<p class="footer">${escapeHtml(ticket.footer)}</p>` : `<p class="footer">¡Gracias por su compra!</p>`}
</body></html>`;
}

export function printTicket(ticket: TicketData): void {
  const html = generateTicketHTML(ticket);
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    // Fallback: intentar impresión directa
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${ticket.ticketNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

export async function printViaWebUSB(ticket: TicketData): Promise<void> {
  try {
    const device = await (navigator as any).usb.requestDevice({
      filters: [
        { vendorId: 0x0416 }, // BIXOLON
        { vendorId: 0x04b8 }, // EPSON
        { vendorId: 0x067b }, // Star Micronics
      ],
    });
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    const encoder = new TextEncoder();
    let text = `\x1b\x40` + // Reset printer
      `\x1b\x61\x01` + // Center align
      `\x1b\x21\x30` + // Double height + width
      `${ticket.businessName}\n` +
      `\x1b\x21\x00` + // Normal text
      `\x1b\x61\x01` +
      `Ticket N°: ${ticket.ticketNumber}\n` +
      `${ticket.date}\n` +
      `\x1b\x61\x00` + // Left align
      `Cajero: ${ticket.cashier}\n` +
      `${'─'.repeat(32)}\n`;

    ticket.items.forEach((item) => {
      text += `${item.name} x${item.qty}  $${item.total.toFixed(2)}\n`;
    });

    text += `${'─'.repeat(32)}\n`;
    text += `TOTAL: $${ticket.total.toFixed(2)}\n\n`;
    text += `\x1d\x56\x00`; // Cut paper

    await device.transferOut(1, encoder.encode(text));
    await device.close();
  } catch (err: any) {
    console.warn('WebUSB print no disponible, use printTicket() como fallback:', err.message);
  }
}
