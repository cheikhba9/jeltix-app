// Format utilities for Jël Tix ("Saisissez • Réservez • Profitez")

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) {
    return "À l'instant";
  }
  if (diffInSeconds < 60) {
    return `Il y a ${diffInSeconds} sec`;
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} min`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Il y a ${diffInHours} h`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  return `Il y a ${diffInDays} j`;
}

export function formatDateFrench(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateWithDay(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function generateTicketCode(): string {
  const prefix = "JT";
  const num = Math.floor(1000 + Math.random() * 9000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = letters.charAt(Math.floor(Math.random() * letters.length));
  return `${prefix}-${num}-${letter}`;
}

export function generateOrderReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CMD-JT-${year}-${rand}`;
}

/**
 * Détermine si un événement est terminé ou clôturé :
 * 1. Statut manuellement mis à 'CLOSED'
 * 2. Date de fin 'endDate' dépassée
 * 3. Date de début 'startDate' + heure dépassée de plus de 4 heures
 */
export function isEventClosedOrPast(event: {
  status?: string;
  startDate?: string;
  endDate?: string;
  timeString?: string;
} | null | undefined): boolean {
  if (!event) return false;
  // Si l'organisateur a explicitement clôturé
  if (event.status === 'CLOSED') return true;

  const now = Date.now();

  // Helper pour parser une date ou chaîne YYYY-MM-DD jusqu'à la fin de la journée (23:59:59.999)
  const parseToEndOfDay = (dateStr: string): number => {
    // Si format simple YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      const [year, month, day] = dateStr.trim().split('-').map(Number);
      return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return NaN;
    // Si l'heure est 00:00:00 (typiquement un sélecteur de date pur), on étend à la fin de la journée
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      d.setUTCHours(23, 59, 59, 999);
    }
    return d.getTime();
  };

  // 1. Si une date de fin explicite (endDate) est définie, les ventes restent ouvertes jusqu'à la fin de ce jour
  if (event.endDate) {
    const endTimestamp = parseToEndOfDay(event.endDate);
    if (!isNaN(endTimestamp)) {
      return now > endTimestamp;
    }
  }

  // 2. Si aucune endDate mais une date de début
  if (event.startDate) {
    const start = new Date(event.startDate);
    if (!isNaN(start.getTime())) {
      // Extraire l'heure si renseignée (ex: "23:00 UTC", "20:30")
      let eventStartTimestamp = start.getTime();
      if (event.timeString) {
        const timeMatch = event.timeString.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          // Si l'événement démarre en soirée (ex: 22h, 23h), il se prolonge jusqu'au lendemain matin (+12h)
          start.setHours(hours, minutes, 0, 0);
          eventStartTimestamp = start.getTime();
        }
      }

      // Par défaut pour un événement en cours ou du jour : actif jusqu'au lendemain matin (+14 heures après début ou fin de journée)
      const eventEndWithBuffer = Math.max(
        eventStartTimestamp + 14 * 60 * 60 * 1000,
        parseToEndOfDay(event.startDate)
      );

      return now > eventEndWithBuffer;
    }
  }

  return false;
}

