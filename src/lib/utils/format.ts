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
  if (event.status === 'CLOSED') return true;

  const now = Date.now();

  // 1. Vérification de la date de fin explicite
  if (event.endDate) {
    const end = new Date(event.endDate).getTime();
    if (!isNaN(end) && now > end) {
      return true;
    }
  }

  // 2. Vérification de la date de début + durée par défaut (4h)
  if (event.startDate) {
    const start = new Date(event.startDate);
    if (!isNaN(start.getTime())) {
      // Si timeString contient une heure (ex: "18:00" ou "20:30 UTC") et start est à minuit
      if (event.timeString && start.getHours() === 0 && start.getMinutes() === 0) {
        const timeMatch = event.timeString.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          start.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
        }
      }
      // On considère l'événement clôturé 4 heures après le coup d'envoi
      const eventEndTime = start.getTime() + 4 * 60 * 60 * 1000;
      if (now > eventEndTime) {
        return true;
      }
    }
  }

  return false;
}

