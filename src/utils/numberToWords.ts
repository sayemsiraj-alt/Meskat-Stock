// Bengali & English Number to Words & Currency Formatter for Invoices & Chalans

const ones: Record<number, string> = {
  0: '', 1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 
  6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
  11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো',
  16: 'ষোল', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
  21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ',
  26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আঠাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
  31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ',
  36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
  41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ',
  46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
  51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন',
  56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
  61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌষট্টি', 65: 'পঁয়ষট্টি',
  66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
  71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর',
  76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনাশি', 80: 'আশি',
  81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশি',
  86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'অষ্টআশি', 89: 'ঊননব্বই', 90: 'নব্বই',
  91: 'একানব্বই', 92: 'বানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই',
  96: 'ছিয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই'
};

export const toBengaliDigits = (num: number | string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (w) => bnDigits[+w]);
};

export const numberToBengaliWords = (amount: number): string => {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'শূন্য টাকা মাত্র';

  let remaining = n;
  const parts: string[] = [];

  // কোটি (Crore) - 10^7
  if (remaining >= 10000000) {
    const crore = Math.floor(remaining / 10000000);
    parts.push(`${numberToBengaliWordsSimple(crore)} কোটি`);
    remaining %= 10000000;
  }

  // লক্ষ (Lakh) - 10^5
  if (remaining >= 100000) {
    const lakh = Math.floor(remaining / 100000);
    parts.push(`${ones[lakh] || numberToBengaliWordsSimple(lakh)} লক্ষ`);
    remaining %= 100000;
  }

  // হাজার (Thousand) - 10^3
  if (remaining >= 1000) {
    const thousand = Math.floor(remaining / 1000);
    parts.push(`${ones[thousand] || numberToBengaliWordsSimple(thousand)} হাজার`);
    remaining %= 1000;
  }

  // শত (Hundred) - 10^2
  if (remaining >= 100) {
    const hundred = Math.floor(remaining / 100);
    parts.push(`${ones[hundred]} শত`);
    remaining %= 100;
  }

  // 1-99
  if (remaining > 0) {
    parts.push(ones[remaining] || String(remaining));
  }

  return `${parts.filter(Boolean).join(' ')} টাকা মাত্র`;
};

const numberToBengaliWordsSimple = (n: number): string => {
  if (n <= 99) return ones[n] || String(n);
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    return `${ones[hundred]} শত ${ones[rem] || ''}`.trim();
  }
  return String(n);
};

// English Number to Words Converter
const a = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];
const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

export const numberToEnglishWords = (amount: number): string => {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Zero Taka Only';

  const convertLessThanOneThousand = (num: number): string => {
    let current = '';
    if (num % 100 < 20) {
      current = a[num % 100];
      num = Math.floor(num / 100);
    } else {
      current = a[num % 10];
      num = Math.floor(num / 10);
      current = b[num % 10] + (current ? ' ' + current : '');
      num = Math.floor(num / 10);
    }
    if (num === 0) return current;
    return a[num] + ' Hundred' + (current ? ' ' + current : '');
  };

  let num = n;
  const parts: string[] = [];

  // Crores (10^7)
  if (num >= 10000000) {
    const crore = Math.floor(num / 10000000);
    parts.push(`${convertLessThanOneThousand(crore)} Crore`);
    num %= 10000000;
  }

  // Lakhs (10^5)
  if (num >= 100000) {
    const lakh = Math.floor(num / 100000);
    parts.push(`${convertLessThanOneThousand(lakh)} Lakh`);
    num %= 100000;
  }

  // Thousands (10^3)
  if (num >= 1000) {
    const thousand = Math.floor(num / 1000);
    parts.push(`${convertLessThanOneThousand(thousand)} Thousand`);
    num %= 1000;
  }

  // Hundreds
  if (num > 0) {
    parts.push(convertLessThanOneThousand(num));
  }

  return `${parts.filter(Boolean).join(' ')} Taka Only`;
};

// Formats number in South Asian / Bangladeshi comma system (e.g. 10,51,326/=)
export const formatTkAmount = (val: number | string | undefined, withTrailingSlash = true): string => {
  if (val === undefined || val === null || val === '') return '0/=';
  const num = Math.round(Number(val));
  const isNeg = num < 0;
  const absStr = Math.abs(num).toString();
  
  if (absStr.length <= 3) {
    return `${isNeg ? '-' : ''}${absStr}${withTrailingSlash ? '/=' : ''}`;
  }
  
  const lastThree = absStr.substring(absStr.length - 3);
  const otherNumbers = absStr.substring(0, absStr.length - 3);
  const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const formatted = `${formattedOther},${lastThree}`;
  
  return `${isNeg ? '-' : ''}${formatted}${withTrailingSlash ? '/=' : ''}`;
};
