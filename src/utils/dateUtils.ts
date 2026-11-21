// Returns YYYY-MM-DD in local time
export const getLocalYYYYMMDD = (d = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Returns YYYY-MM-DD HH:mm:ss without invalid date fallback bugs
export const getFormattedLocalDateTime = (dateInput?: string | Date): string => {
  if (!dateInput) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Pure YYYY-MM-DD e.g. "2026-10-11"
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const now = new Date();
      const timePart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      return `${trimmed} ${timePart}`;
    }
    // Already has date and time "2026-10-11 14:30:00" or "2026-10-11T14:30:00"
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.replace('T', ' ');
    }
    const parts = trimmed.split('T')[0].split(' ');
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
      return trimmed.replace('T', ' ');
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return getFormattedLocalDateTime();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Helper for "Days Ago" YYYY-MM-DD
export const getDaysAgoYYYYMMDD = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalYYYYMMDD(d);
};

// Helper for First Day of Current Month YYYY-MM-DD
export const getFirstDayOfMonthYYYYMMDD = (): string => {
  const d = new Date();
  return getLocalYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1));
};

// Helper for Previous Month Start & End YYYY-MM-DD
export const getLastMonthRangeYYYYMMDD = (refDate = new Date()): { start: string; end: string } => {
  const start = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const end = new Date(refDate.getFullYear(), refDate.getMonth(), 0);
  return {
    start: getLocalYYYYMMDD(start),
    end: getLocalYYYYMMDD(end),
  };
};

// Extracts YYYY-MM-DD from any date string ("2026-08-07T03:42:00" or "2026-08-07 03:42:00" or "2026-08-07")
export const extractYYYYMMDD = (dateStr: string): string => {
  if (!dateStr) return getLocalYYYYMMDD();
  const s = String(dateStr).trim();
  const firstPart = s.split('T')[0].split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstPart)) {
    return firstPart;
  }
  return getLocalYYYYMMDD();
};

// Formats YYYY-MM-DD or date object to DD/MM/YY (e.g. 27/01/26)
export const formatDDMMYY = (dateInput?: string | Date): string => {
  if (!dateInput) return '00/00/26';
  const ymd = typeof dateInput === 'string' ? extractYYYYMMDD(dateInput) : getLocalYYYYMMDD(dateInput);
  const parts = ymd.split('-');
  if (parts.length === 3) {
    const yy = parts[0].slice(-2);
    const mm = parts[1];
    const dd = parts[2];
    return `${dd}/${mm}/${yy}`;
  }
  return '00/00/26';
};
