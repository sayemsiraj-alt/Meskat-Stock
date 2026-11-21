import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  RefreshCw,
  Maximize2,
  Minimize2,
  ChevronRight,
  Calendar,
  Move,
  EyeOff,
  Eye
} from 'lucide-react';
import { 
  StockItem, 
  StockTransaction, 
  Invoice, 
  Wholesaler, 
  Category 
} from '../data/mockData';
import { CompanyLogo } from './CompanyLogo';
import { getLocalYYYYMMDD, extractYYYYMMDD } from '../utils/dateUtils';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  matchedItems?: StockItem[];
  summaryData?: {
    title: string;
    metrics: { label: string; value: string | number; color?: string }[];
  };
}

interface AiChatbotProps {
  items: StockItem[];
  transactions: StockTransaction[];
  invoices: Invoice[];
  wholesalers: Wholesaler[];
  categories: Category[];
  currency: string;
  brandName: string;
  brandShortName: string;
  logoUrl?: string;
  onNavigateTab?: (tab: string) => void;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({
  items,
  transactions,
  invoices,
  wholesalers,
  categories: _categories,
  currency,
  brandName,
  brandShortName,
  logoUrl,
  onNavigateTab
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false); // Hide / show floating button
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // --- DRAGGABLE POSITION STATE & VIEWPORT TRACKING ---
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 72) : 300;
    const defaultY = typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 76) : 500;
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewport({ w, h });
      setPosition((prev) => ({
        x: Math.max(12, Math.min(w - 68, prev.x)),
        y: Math.max(12, Math.min(h - 68, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  const getLocalTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Initial Welcome Message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: `আসসালামু আলাইকুম! আমি **${brandName} AI Assistant**।🤖\nআমি রিয়েলটাইমে আপনার স্টক, বিক্রি, বকেয়া এবং প্রোডাক্টের সঠিক হিসাব দিতে পারি। আপনি যেকোনো প্রোডাক্টের নাম বাংলায় বা ইংরেজিতে (যেমন: "Hair Tonic", "ফেসওয়াশ", "স্টক কত") লিখে সার্চ করতে পারেন।`,
      time: getLocalTime(),
    }
  ]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Handle Drag Events (Mouse & Touch)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    hasMovedRef.current = false;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { ...position };
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        hasMovedRef.current = true;
      }

      const newX = Math.max(10, Math.min(window.innerWidth - 60, initialPosRef.current.x + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 60, initialPosRef.current.y + deltaY));

      setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  // Toggle button click (only if not dragged)
  const handleButtonClick = () => {
    if (!hasMovedRef.current) {
      setIsOpen(true);
    }
  };

  // --- SMART NATURAL LANGUAGE QUERY ENGINE ---
  const processQuery = (rawQuery: string) => {
    const q = rawQuery.toLowerCase().trim();
    let responseText = '';
    let matchedProducts: StockItem[] = [];
    let summaryData: ChatMessage['summaryData'] = undefined;

    const normalizedQuery = q.replace(/[^a-z0-9\u0980-\u09FF\s]/gi, '');
    
    // Fuzzy search against items
    const foundItems = items.filter(item => {
      const nameLower = item.name.toLowerCase();
      const skuLower = item.sku.toLowerCase();
      const catLower = item.category.toLowerCase();

      if (nameLower.includes(q) || skuLower.includes(q) || catLower.includes(q)) return true;

      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
      return queryWords.some(w => nameLower.includes(w) || skuLower.includes(w) || catLower.includes(w));
    });

    const isAskingAboutTodayReport = (q.includes('today') || q.includes('আজকের') || q.includes('আজ')) && (q.includes('report') || q.includes('রিপোর্ট') || q.includes('stock') || q.includes('স্টক') || q.includes('হিসাব'));
    const isAskingAboutStock = q.includes('stock') || q.includes('কতো') || q.includes('কত') || q.includes('pic') || q.includes('pcs') || q.includes('piece') || q.includes('available') || q.includes('আছে');
    const isAskingAboutLowStock = q.includes('low') || q.includes('কম') || q.includes('out') || q.includes('শেষ') || q.includes('খালি') || q.includes('alert');
    const isAskingAboutSales = q.includes('sale') || q.includes('বিক্রি') || q.includes('chalan') || q.includes('চালান');
    const isAskingAboutDue = q.includes('due') || q.includes('বকেয়া') || q.includes('বকেয়া') || q.includes('পাওনা') || q.includes('customer');
    const isAskingAboutSummary = q.includes('summary') || q.includes('মোট') || q.includes('হিসাব') || q.includes('valuation') || q.includes('asset');

    if (isAskingAboutTodayReport) {
      const todayStr = getLocalYYYYMMDD();
      const todayTxns = transactions.filter(t => extractYYYYMMDD(t.date) === todayStr);

      const todayIn = todayTxns.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
      const todayReturn = todayTxns.filter(t => t.type === 'RETURN').reduce((sum, t) => sum + t.quantity, 0);
      const todayOut = todayTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);

      const todayInvoices = invoices.filter(i => extractYYYYMMDD(i.date) === todayStr);
      const todaySalesVal = todayInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
      const todayCashPaid = todayInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
      const totalAvailable = items.reduce((sum, i) => sum + i.quantity, 0);

      responseText = `📅 **আজকের লাইভ স্টক ও বেচাকেনা রিপোর্ট (${todayStr}):**\n• আজকের স্টক ইন: **+${todayIn.toLocaleString()} Pcs**\n• আজকের প্রোডাক্ট রিটার্ন: **+${todayReturn.toLocaleString()} Pcs**\n• আজকের স্টক আউট/ডিচপ্যাচ: **-${todayOut.toLocaleString()} Pcs**\n• আজকের মোট চালানের সেল: **${formatCurr(todaySalesVal)}** (নগদ জমা: ${formatCurr(todayCashPaid)})\n• বর্তমান মোট মজুদ স্টক: **${totalAvailable.toLocaleString()} Pcs**`;

      summaryData = {
        title: `Today's Live Stock Report (${todayStr})`,
        metrics: [
          { label: "Today Stock In", value: `+${todayIn} Pcs`, color: 'text-emerald-400' },
          { label: "Today Returns", value: `+${todayReturn} Pcs`, color: 'text-amber-400' },
          { label: "Today Stock Out", value: `-${todayOut} Pcs`, color: 'text-cyan-400' },
          { label: "Today Sales Val", value: formatCurr(todaySalesVal), color: 'text-blue-400' }
        ]
      };
    } else if (foundItems.length > 0 && !isAskingAboutLowStock && !isAskingAboutSales && !isAskingAboutDue && !isAskingAboutSummary) {
      matchedProducts = foundItems.slice(0, 5);
      if (matchedProducts.length === 1) {
        const item = matchedProducts[0];
        responseText = `অ্যানালিটিক্স আপডেট: **${item.name}** বর্তমানে আপনার স্টকে **${item.quantity} ${item.unit}** রয়েছে।\n• ক্যাটাগরি: ${item.category}\n• ইউনিট মূল্য: ${formatCurr(item.price)}\n• অবস্থান/শেলফ: ${item.location}`;
      } else {
        responseText = `আপনার খোঁজা অনুযায়ী **${matchedProducts.length}টি প্রোডাক্ট** স্টকে পাওয়া গেছে:`;
      }
    } else if (isAskingAboutLowStock) {
      const lowItems = items.filter(i => i.quantity <= i.reorderThreshold);
      matchedProducts = lowItems;
      if (lowItems.length === 0) {
        responseText = `🎉 চমৎকার! বর্তমানে আপনার কোনো প্রোডাক্টের স্টক কম বা শেষ হয়ে যায়নি। সব আইটেম পর্যাপ্ত রয়েছে।`;
      } else {
        responseText = `⚠️ **জরুরি স্টক অ্যালার্ট:** বর্তমানে **${lowItems.length}টি প্রোডাক্টের** স্টক কমে গেছে বা শেষ হয়ে গেছে। রিস্টক করার অনুরোধ করা হচ্ছে:`;
      }
    } else if (isAskingAboutSales) {
      const totalSales = invoices.reduce((s, i) => s + i.totalAmount, 0);
      const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
      const totalDue = invoices.reduce((s, i) => s + i.dueAmount, 0);

      responseText = `📊 **বিক্রি ও চালানের লাইভ হিসাব:**\n• মোট চালান তৈরি হয়েছে: **${invoices.length}টি**\n• মোট বিক্রির পরিমাণ: **${formatCurr(totalSales)}**\n• মোট ক্যাশ রিসিভড: **${formatCurr(totalPaid)}**\n• মোট বাকি/বকেয়া: **${formatCurr(totalDue)}**`;
      
      summaryData = {
        title: 'Sales & Revenue Summary',
        metrics: [
          { label: 'Total Invoices', value: `${invoices.length} Chalans` },
          { label: 'Total Sales', value: formatCurr(totalSales), color: 'text-emerald-600' },
          { label: 'Cash Paid', value: formatCurr(totalPaid), color: 'text-blue-600' },
          { label: 'Due Balance', value: formatCurr(totalDue), color: 'text-rose-600' }
        ]
      };
    } else if (isAskingAboutDue) {
      const dueWholesalers = wholesalers.filter(w => w.totalDue > 0);
      const totalDueVal = wholesalers.reduce((s, w) => s + w.totalDue, 0);

      if (dueWholesalers.length === 0) {
        responseText = `✅ বাজারে কোনো কাস্টমারের কাছে পাওনা বকেয়া নেই। সব বকেয়া পরিশোধিত!`;
      } else {
        responseText = `💰 **কাস্টমারদের বকেয়ার লাইভ হিসাব:**\nবর্তমানে **${dueWholesalers.length}জন কাস্টমারের** কাছে মোট **${formatCurr(totalDueVal)}** বকেয়া পাওনা আছে।`;
        summaryData = {
          title: 'Outstanding Market Dues',
          metrics: dueWholesalers.slice(0, 4).map(w => ({
            label: w.name,
            value: formatCurr(w.totalDue),
            color: 'text-rose-600'
          }))
        };
      }
    } else if (isAskingAboutSummary || isAskingAboutStock) {
      const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.price), 0);
      const lowCount = items.filter(i => i.quantity <= i.reorderThreshold).length;

      matchedProducts = [...items];

      responseText = `📦 **ইনভেন্টরি সামারি রিপোর্টিং:**\n• মোট প্রোডাক্ট আইটেম (SKU): **${items.length}টি**\n• মোট বর্তমান মজুদ (Units): **${totalCount.toLocaleString()} Pcs**\n• মোট ইনভেন্টরি সম্পদের মূল্য: **${formatCurr(totalValue)}**\n• রিঅর্ডার অ্যালার্ট আইটেম: **${lowCount}টি**\n\nনিচে প্রতিটি প্রোডাক্টভিত্তিক বর্তমান মজুদের তালিকা দেওয়া হলো:`;
      
      summaryData = {
        title: 'Central Stock Overview',
        metrics: [
          { label: 'Total Products (SKUs)', value: items.length },
          { label: 'Total Units Available', value: `${totalCount.toLocaleString()} Pcs` },
          { label: 'Total Asset Worth', value: formatCurr(totalValue), color: 'text-emerald-600' },
          { label: 'Low Stock Alert', value: `${lowCount} Items`, color: lowCount > 0 ? 'text-amber-600' : 'text-slate-600' }
        ]
      };
    } else {
      responseText = `পর্মার্শ: আমি আপনার সিস্টেমের লাইভ ডাটাবেজ থেকে যেকোনো তথ্য দিতে পারি। আপনি নিচের কুইক বাটনগুলো চাপুন অথবা যেকোনো প্রোডাক্টের নাম লিখে মেসেজ পাঠান!`;
    }

    return { responseText, matchedProducts, summaryData };
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: getLocalTime()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const { responseText, matchedProducts, summaryData } = processQuery(query);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: responseText,
        time: getLocalTime(),
        matchedItems: matchedProducts,
        summaryData: summaryData
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className="select-none no-print">
      
      {/* --- HIDDEN TRIGGER HANDLE (Show when user hides floating button) --- */}
      {isHidden && !isOpen && (
        <button
          type="button"
          onClick={() => setIsHidden(false)}
          className="fixed bottom-6 right-0 z-50 bg-slate-900 hover:bg-slate-800 text-teal-400 p-2.5 rounded-l-2xl border-l-2 border-y border-teal-500/80 shadow-2xl transition flex items-center gap-1.5 font-bold text-xs group"
          title="Show AI Assistant"
        >
          <Bot className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
          <Eye className="w-3.5 h-3.5 text-slate-300" />
        </button>
      )}

      {/* --- DRAGGABLE & HIDEABLE FLOATING AI BUTTON --- */}
      {!isOpen && !isHidden && (
        <div
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            touchAction: 'none'
          }}
          className="group flex items-center gap-1"
        >
          {/* Main Round AI Floating Button */}
          <button
            type="button"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={handleButtonClick}
            className="relative flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-full shadow-2xl border-2 border-emerald-500/70 hover:border-emerald-400 transition-transform active:scale-95 cursor-grab active:cursor-grabbing"
            title="Drag to Move • Click to Open AI Assistant"
          >
            {/* Animated Glow Halo */}
            <span className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-50 blur-md group-hover:opacity-85 transition duration-300 pointer-events-none"></span>
            
            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-md">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
            </div>
          </button>

          {/* Quick Controls Pill on Hover (Drag handle + Hide) */}
          <div className="hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl shadow-lg backdrop-blur-xs animate-fade-in">
            <span className="p-1 text-slate-400 hover:text-white cursor-grab" title="Hold & Drag Anywhere">
              <Move className="w-3.5 h-3.5" />
            </span>
            <button
              type="button"
              onClick={() => setIsHidden(true)}
              className="p-1 text-slate-400 hover:text-rose-400 transition"
              title="Hide AI Button"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* --- EXPANDABLE AI CHAT DRAWER WINDOW --- */}
      {isOpen && (() => {
        const isMobile = viewport.w < 640;
        const desktopWidth = Math.min(isExpanded ? 650 : 420, viewport.w - 24);
        const desktopHeight = Math.min(
          isExpanded ? Math.round(viewport.h * 0.82) : 540,
          viewport.h - 24
        );
        const clampedLeft = Math.max(
          12,
          Math.min(viewport.w - desktopWidth - 12, position.x - desktopWidth + 56)
        );
        const clampedTop = Math.max(
          12,
          Math.min(viewport.h - desktopHeight - 12, position.y - desktopHeight + 56)
        );

        const drawerStyle: React.CSSProperties = isMobile
          ? {
              position: 'fixed',
              left: '12px',
              right: '12px',
              bottom: '12px',
              height: isExpanded ? 'min(88dvh, 680px)' : 'min(78dvh, 520px)',
              zIndex: 9999,
            }
          : {
              position: 'fixed',
              left: `${clampedLeft}px`,
              top: `${clampedTop}px`,
              width: `${desktopWidth}px`,
              height: `${desktopHeight}px`,
              zIndex: 9999,
            };

        return (
        <div
          style={drawerStyle}
          className="bg-slate-900 text-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden transition-all duration-200 animate-fade-in max-w-full"
        >
          
          {/* CHAT HEADER */}
          <div className="p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <CompanyLogo className="w-9 h-9 sm:w-10 sm:h-10 border-emerald-500/40 shrink-0" shortName={brandShortName} logoUrl={logoUrl} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h4 className="font-extrabold text-sm text-white truncate">{brandName} AI</h4>
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold shrink-0">
                    LIVE DATA
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <Sparkles className="w-3 h-3 text-cyan-400 inline shrink-0" />
                  <span className="truncate">Real-time Assistant & Product Finder</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title={isExpanded ? 'Minimize Window' : 'Expand Window'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Close AI Assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* QUICK PROMPT SUGGESTIONS */}
          <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => handleSendMessage('আজকের স্টক রিপোর্ট')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Calendar className="w-3 h-3 text-blue-400" />
              <span>আজকের স্টক রিপোর্ট</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('স্টক সামারি কত?')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <Package className="w-3 h-3 text-emerald-400" />
              <span>স্টক সামারি</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('কোন প্রোডাক্টের স্টক কম আছে?')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>কম স্টক লিস্ট</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('আজকের বিক্রির হিসাব')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span>মোট বিক্রি</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('বকেয়া টাকা কত আছে?')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3 text-rose-400" />
              <span>বকেয়া হিসাব</span>
            </button>
          </div>

          {/* CHAT MESSAGES CONTAINER */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 flex items-center justify-center font-extrabold shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2.5 ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold p-3 rounded-2xl rounded-tr-xs shadow-md' 
                    : 'bg-slate-800/90 text-slate-100 p-3.5 rounded-2xl rounded-tl-xs border border-slate-700/80 shadow-xs'
                }`}>
                  <p className="whitespace-pre-line leading-relaxed text-xs">
                    {msg.text}
                  </p>

                  {/* SUMMARY METRICS CARD IF ANY */}
                  {msg.summaryData && (
                    <div className="mt-2.5 bg-slate-900/90 p-3 rounded-xl border border-slate-700 space-y-2">
                      <p className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wide">
                        {msg.summaryData.title}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {msg.summaryData.metrics.map((m, idx) => (
                          <div key={idx} className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                            <span className="text-slate-400 block text-[10px]">{m.label}</span>
                            <span className={`font-extrabold font-mono text-xs ${m.color || 'text-white'}`}>
                              {m.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MATCHED PRODUCT CARDS LIST IF ANY */}
                  {msg.matchedItems && msg.matchedItems.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {msg.matchedItems.map(item => {
                        const isOut = item.quantity <= 0;
                        const isLow = item.quantity <= item.reorderThreshold && item.quantity > 0;

                        return (
                          <div
                            key={item.id}
                            className="bg-slate-900/90 p-3 rounded-xl border border-slate-700 space-y-2 hover:border-emerald-500/50 transition"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h5 className="font-extrabold text-white text-xs">{item.name}</h5>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {item.sku} • {item.category}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                isOut ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                isLow ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-800">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Available Quantity:</span>
                                <span className="font-extrabold text-emerald-400 text-sm">{item.quantity} {item.unit}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">Unit Price:</span>
                                <span className="font-extrabold text-white text-sm">{formatCurr(item.price)}</span>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-400 pt-1 flex justify-between items-center border-t border-slate-800/80">
                              <span>Location: <strong className="text-slate-200">{item.location}</strong></span>
                              {onNavigateTab && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onNavigateTab('inventory');
                                    setIsOpen(false);
                                  }}
                                  className="text-emerald-400 hover:underline font-bold flex items-center gap-0.5"
                                >
                                  <span>View Item</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <span className={`block text-[9px] mt-1 ${msg.sender === 'user' ? 'text-slate-900/80 text-right font-medium' : 'text-slate-400'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center text-slate-400 text-xs italic bg-slate-800/60 p-2.5 rounded-xl w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>AI Assistant thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* CHAT INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Search product (যেমন: 'Hair Tonic' বা 'কতো পিস')..."
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-slate-900 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`p-2.5 rounded-xl transition shrink-0 ${
                inputText.trim() 
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold shadow-md hover:from-emerald-600' 
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
        );
      })()}

    </div>
  );
};
