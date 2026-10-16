import type { Ticket, EventItem } from '@/types';
import { formatDateWithDay, formatFCFA } from './format';

export function formatWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Si commence déjà par 221 et a la bonne longueur (11 ou 12 chiffres)
  if (digits.startsWith('221') && digits.length >= 11) {
    return digits;
  }
  // Si numéro sénégalais classique à 9 chiffres (77, 78, 76, 75, 70...)
  if (digits.length === 9) {
    return `221${digits}`;
  }
  return digits;
}

export function buildWhatsAppTicketMessage(
  ticket: Ticket,
  event: EventItem | null | undefined,
  ticketUrl: string
): string {
  const eventDate = event ? formatDateWithDay(event.startDate) : 'Date à confirmer';
  const eventTime = event?.timeString || '19:00';
  const venue = event?.venue || 'Dakar';
  const location = event?.locationDetails ? ` (${event.locationDetails})` : '';

  return (
    `🎟️ *VOTRE E-BILLET OFFICIEL JËL TIX*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 *Événement :* ${ticket.eventTitle}\n` +
    `📅 *Date :* ${eventDate}\n` +
    `⏰ *Heure :* ${eventTime}\n` +
    `📍 *Lieu :* ${venue}${location}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Titulaire :* ${ticket.customerName}\n` +
    `🏷️ *Catégorie :* ${ticket.ticketTypeName}\n` +
    `💰 *Montant :* ${formatFCFA(ticket.pricePaid)} FCFA\n` +
    `🔢 *Code Billet :* ${ticket.ticketCode}\n` +
    `🚪 *Porte d'accès :* ${ticket.gateRecommendation || 'Accès principal'}\n` +
    `🪑 *Placement :* ${ticket.seatNumber || 'Gradins libres'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📲 *VOIR VOTRE QR CODE & PHOTO DU BILLET :*\n` +
    `👉 ${ticketUrl}\n\n` +
    `⚠️ *Conservez ce message. Présentez le QR Code officiel à l'entrée de l'événement.*`
  );
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Génère une image PNG haute définition (format Photo smartphone) du billet
 * avec dégradé, typographie nette, badge officiel et QR code scannable.
 */
export async function generateTicketPhoto(
  ticket: Ticket,
  event: EventItem | null | undefined,
  qrCanvasElement: HTMLCanvasElement | null
): Promise<string> {
  const width = 800;
  const height = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le contexte 2D');

  // Fond dégradé premium nuit Jël Tix
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#050D1E');
  bgGrad.addColorStop(0.5, '#071633');
  bgGrad.addColorStop(1, '#030814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Bordure lumineuse
  ctx.strokeStyle = 'rgba(78, 237, 21, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Header Banner
  const headerGrad = ctx.createLinearGradient(20, 20, width - 20, 140);
  headerGrad.addColorStop(0, '#002D8C');
  headerGrad.addColorStop(0.5, '#0038A8');
  headerGrad.addColorStop(1, '#0D52D6');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(20, 20, width - 40, 120);

  // Charger et dessiner le vrai logo officiel Jël Tix
  const loadLogo = (): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });
  };

  const logoImg = await loadLogo();
  if (logoImg) {
    // Conteneur blanc arrondi pour faire ressortir le logo officiel
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(40, 32, 95, 95, 18);
    ctx.clip();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(40, 32, 95, 95);
    ctx.drawImage(logoImg, 40, 32, 95, 95);
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('Jël', 150, 85);
    ctx.fillStyle = '#4EED15';
    ctx.fillText('Tix', 215, 85);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'italic bold 13px sans-serif';
    ctx.fillText('Billetterie Officielle Sécurisée', 150, 112);
  } else {
    // Repli typographique élégant
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('Jël', 50, 85);
    ctx.fillStyle = '#4EED15';
    ctx.fillText('Tix', 115, 85);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'italic bold 13px sans-serif';
    ctx.fillText('Billetterie Officielle Sécurisée', 50, 112);
  }

  // Badge ACTIF
  ctx.fillStyle = '#4EED15';
  ctx.beginPath();
  ctx.roundRect(width - 240, 60, 190, 40, 20);
  ctx.fill();

  ctx.fillStyle = '#002D8C';
  ctx.font = '900 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('● BILLET OFFICIEL', width - 145, 85);
  ctx.textAlign = 'left';

  // Section Événement
  ctx.fillStyle = '#4EED15';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(ticket.ticketTypeName.toUpperCase(), 50, 195);

  // Titre de l'événement (avec retour à la ligne automatique si long)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px sans-serif';
  const title = ticket.eventTitle;
  if (title.length > 32) {
    ctx.fillText(title.substring(0, 32), 50, 240);
    ctx.fillText(title.substring(32, 64) + (title.length > 64 ? '…' : ''), 50, 280);
  } else {
    ctx.fillText(title, 50, 250);
  }

  // Date, Heure & Lieu
  const eventDate = event ? formatDateWithDay(event.startDate) : 'Date à confirmer';
  const eventTime = event?.timeString || '18:00 UTC';
  const venue = event?.venue || 'Stade Abdoulaye Wade';

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 16px sans-serif';
  ctx.fillText(`📅  ${eventDate}  •  ⏰  ${eventTime}`, 50, 325);
  ctx.fillText(`📍  ${venue}`, 50, 355);

  // Ligne de découpe pointillée
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 395);
  ctx.lineTo(width - 50, 395);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Infos Spectateur & Billet (2 colonnes)
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('TITULAIRE DU BILLET', 50, 435);
  ctx.fillText('PORTION / CATÉGORIE', 420, 435);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px sans-serif';
  ctx.fillText(ticket.customerName, 50, 465);
  ctx.fillText(ticket.ticketTypeName, 420, 465);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('PORTE D\'ACCÈS', 50, 515);
  ctx.fillText('MONTANT RÉGLÉ', 420, 515);

  ctx.fillStyle = '#4EED15';
  ctx.font = '900 20px sans-serif';
  ctx.fillText(ticket.gateRecommendation || 'Porte A (Principale)', 50, 545);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${formatFCFA(ticket.pricePaid)} FCFA`, 420, 545);

  // Zone Blanche pour le QR Code Haute Fidélité
  const qrBoxSize = 340;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 590;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
  ctx.fill();

  // Dessin du QR Code
  if (qrCanvasElement) {
    const qrInnerSize = 280;
    const qrInnerOffset = (qrBoxSize - qrInnerSize) / 2;
    ctx.drawImage(
      qrCanvasElement,
      qrBoxX + qrInnerOffset,
      qrBoxY + qrInnerOffset,
      qrInnerSize,
      qrInnerSize
    );
  }

  // Code Unique sous le QR
  ctx.fillStyle = '#0038A8';
  ctx.font = '900 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN UNIQUE AUX CONTRÔLEURS', width / 2, qrBoxY + qrBoxSize - 15);

  // Code Billet en grand
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('CODE SÉCURISÉ DU BILLET', width / 2, 985);

  ctx.fillStyle = '#4EED15';
  ctx.font = '900 36px monospace';
  ctx.fillText(ticket.ticketCode, width / 2, 1030);

  // Footer sécurité
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '500 12px sans-serif';
  ctx.fillText('Signature Cryptographique Jël Tix • Anti-Double Passage Activé', width / 2, 1085);
  ctx.fillText('Conservez cette image dans vos photos pour la présenter à l\'entrée.', width / 2, 1110);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
