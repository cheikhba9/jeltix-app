import type { Ticket, EventItem } from '@/types';
import { formatFCFA, formatDateWithDay } from './format';

interface Print57x90Options {
  tickets: Ticket[];
  event?: EventItem | null;
  sellerName?: string;
  paymentMethod?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Lance l'impression thermique instantanée au format exact 57mm x 90mm
 * via un iframe isolé ultra-rapide (<100ms) sans figer le navigateur.
 */
export function printThermal57x90({
  tickets,
  event,
  sellerName,
  paymentMethod,
}: Print57x90Options): void {
  if (typeof window === 'undefined' || !tickets || tickets.length === 0) return;

  // Créer ou réutiliser un iframe caché dédié à l'impression thermique
  let iframe = document.getElementById('jeltix-thermal-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'jeltix-thermal-iframe';
    iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;');
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  const now = new Date();
  const dateEmission = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const heureEmission = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Construction des pages 57mm x 90mm pour chaque billet
  const pagesHtml = tickets.map((tkt, idx) => {
    // Récupérer le SVG QR Code généré dans le DOM
    const qrElement = document.getElementById(`thermal-qr-${tkt.ticketCode}`);
    let qrSvgContent = '';
    if (qrElement) {
      qrSvgContent = qrElement.outerHTML;
    } else {
      // Fallback si l'élément DOM n'est pas encore monté
      qrSvgContent = `<div style="width:34mm;height:34mm;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:9px;">#${escapeHtml(tkt.ticketCode)}</div>`;
    }

    const eventTitle = tkt.eventTitle || event?.title || 'Événement Officiel';
    const eventDate = event?.startDate ? formatDateWithDay(event.startDate) : dateEmission;
    const eventTime = event?.timeString || '19:00';
    const venue = event?.venue || 'Lieu Officiel';
    const paymentLabel = paymentMethod === 'WAVE' ? 'Wave' : paymentMethod === 'ORANGE_MONEY' ? 'Orange Money' : 'Espèces (Caisse)';

    return `
      <div class="ticket-slip">
        <!-- En-tête Organisateur / Plateforme -->
        <div class="top-header">
          <div class="brand">JËL TIX</div>
          <div class="tagline">BILLETTERIE OFFICIELLE</div>
          <div class="event-title">${escapeHtml(eventTitle)}</div>
          <div class="event-meta">${escapeHtml(eventDate)} • ${escapeHtml(eventTime)}</div>
          <div class="event-venue">${escapeHtml(venue)}</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Détails Catégorie et Tarif -->
        <div class="ticket-info">
          <div class="row-bold">
            <span class="type-name">${escapeHtml(tkt.ticketTypeName)}</span>
            <span class="price">${formatFCFA(tkt.pricePaid)} FCFA</span>
          </div>
          <div class="row-small">
            <span>Client: ${escapeHtml(tkt.customerName || 'Client Guichet')}</span>
            <span>${paymentLabel}</span>
          </div>
          <div class="row-small">
            <span>Porte: ${escapeHtml(tkt.gateRecommendation || 'Accès Général')}</span>
            ${tkt.seatNumber ? `<span>Place: ${escapeHtml(tkt.seatNumber)}</span>` : ''}
          </div>
        </div>

        <div class="dotted-line"></div>

        <!-- Code QR Vectoriel Haute Définition -->
        <div class="qr-wrapper">
          <div class="qr-box">
            ${qrSvgContent}
          </div>
          <div class="ticket-code">#${escapeHtml(tkt.ticketCode)}</div>
        </div>

        <div class="dotted-line"></div>

        <!-- Pied de page Sécurité & Caisse -->
        <div class="footer">
          <div>Caisse: ${escapeHtml(sellerName || 'Vendeur')} • ${dateEmission} ${heureEmission}</div>
          <div class="security-text">BILLET OFFICIEL • SCAN UNIQUE OBLIGATOIRE</div>
          <div class="page-count">${idx + 1} / ${tickets.length}</div>
        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>Ticket Thermique 57x90mm - Jël Tix</title>
        <style>
          @page {
            size: 57mm 90mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            width: 57mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
          }
          .ticket-slip {
            width: 57mm;
            height: 90mm;
            max-height: 90mm;
            padding: 2mm 3mm;
            margin: 0;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            overflow: hidden;
            background: #ffffff;
          }
          .top-header {
            width: 100%;
          }
          .brand {
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 1.5px;
            color: #000;
            line-height: 1.1;
          }
          .tagline {
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #333;
            margin-bottom: 1.5px;
          }
          .event-title {
            font-size: 10.5px;
            font-weight: 900;
            line-height: 1.15;
            color: #000;
            max-height: 24px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .event-meta, .event-venue {
            font-size: 8px;
            font-weight: 600;
            color: #222;
            line-height: 1.15;
          }
          .dotted-line {
            width: 100%;
            border-bottom: 1px dashed #000000;
            margin: 1mm 0;
          }
          .ticket-info {
            width: 100%;
          }
          .row-bold {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 11px;
            font-weight: 900;
            color: #000;
          }
          .type-name {
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .price {
            font-size: 11.5px;
            font-family: monospace;
          }
          .row-small {
            width: 100%;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #222;
            margin-top: 0.5mm;
          }
          .qr-wrapper {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .qr-box {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-box svg {
            width: 33mm !important;
            height: 33mm !important;
            display: block;
          }
          .ticket-code {
            font-size: 12.5px;
            font-weight: 900;
            letter-spacing: 2px;
            color: #000;
            margin-top: 0.8mm;
            font-family: monospace;
          }
          .footer {
            width: 100%;
            font-size: 7.5px;
            color: #222;
            line-height: 1.2;
          }
          .security-text {
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-top: 0.5mm;
          }
          .page-count {
            font-size: 7px;
            font-family: monospace;
            color: #555;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Déclencher l'impression instantanée en <100ms
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Erreur print iframe, bascule sur window.print()', err);
      window.print();
    }
  }, 100);
}
