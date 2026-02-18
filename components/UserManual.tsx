
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronRight, ChevronDown, ChevronLeft, Search, X,
  LayoutDashboard, Calculator, Users, Warehouse, BarChart3, Truck, Wrench,
  Settings, User, FileText, Receipt, Download, LogIn, HardHat, Clock,
  CheckCircle2, AlertTriangle, Package, Shield, Wifi, WifiOff, CreditCard,
  Lightbulb, HelpCircle, ArrowRight, Play, Star, Zap, Globe, Smartphone,
  Monitor, MapPin, ClipboardList, TrendingUp, DollarSign, Plus, Minus,
  Eye, EyeOff, Lock, Unlock, Layers, RefreshCw, Bell, Share2, Menu,
  Home, ChevronUp, ArrowUp
} from 'lucide-react';
import { FeedbackButton } from './FeedbackButton';

// ─── Section Data ───────────────────────────────────────────────
interface ManualSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  subsections: ManualSubsection[];
}

interface ManualSubsection {
  id: string;
  title: string;
  content: React.ReactNode;
}

// ─── Animated reveal hook ───────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(el); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

const AnimatedCard: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// ─── Reusable styled components ─────────────────────────────────
const InfoBox: React.FC<{ icon?: React.ElementType; title?: string; children: React.ReactNode; type?: 'info' | 'tip' | 'warning' | 'note' }> = ({ icon: Icon, title, children, type = 'info' }) => {
  const styles = {
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    tip: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    note: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  const iconStyles = {
    info: 'text-sky-500',
    tip: 'text-emerald-500',
    warning: 'text-amber-500',
    note: 'text-slate-400',
  };
  const DefaultIcon = type === 'tip' ? Lightbulb : type === 'warning' ? AlertTriangle : type === 'note' ? HelpCircle : Zap;
  const DisplayIcon = Icon || DefaultIcon;
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${styles[type]} my-3`}>
      <DisplayIcon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyles[type]}`} />
      <div className="text-sm leading-relaxed">
        {title && <span className="font-bold block mb-1">{title}</span>}
        {children}
      </div>
    </div>
  );
};

const StepList: React.FC<{ steps: string[] }> = ({ steps }) => (
  <ol className="space-y-2 my-3">
    {steps.map((step, i) => (
      <li key={i} className="flex gap-3 items-start">
        <span className="shrink-0 w-7 h-7 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center mt-0.5">{i + 1}</span>
        <span className="text-sm text-slate-700 leading-relaxed pt-1">{step}</span>
      </li>
    ))}
  </ol>
);

const KeyValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start gap-2 py-1.5">
    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-32 shrink-0 pt-0.5">{label}</span>
    <span className="text-sm text-slate-700">{value}</span>
  </div>
);

const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${color}`}>{children}</span>
);

const TableSimple: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto my-3 rounded-xl border border-slate-200">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          {headers.map((h, i) => <th key={i} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={`border-b border-slate-100 last:border-0 ${ri % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
            {row.map((cell, ci) => <td key={ci} className="px-4 py-2.5 text-slate-700">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Workflow: React.FC<{ steps: { label: string; active?: boolean; done?: boolean }[] }> = ({ steps }) => (
  <div className="flex items-center gap-1 my-4 overflow-x-auto pb-2">
    {steps.map((step, i) => (
      <React.Fragment key={i}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${step.done ? 'bg-emerald-100 text-emerald-700' : step.active ? 'bg-brand/10 text-brand ring-2 ring-brand/20' : 'bg-slate-100 text-slate-400'}`}>
          {step.done && <CheckCircle2 className="w-3.5 h-3.5" />}
          {step.label}
        </div>
        {i < steps.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
      </React.Fragment>
    ))}
  </div>
);

// ─── Section Content Builders ───────────────────────────────────

const buildSections = (): ManualSection[] => [
  // 1 — Overview
  {
    id: 'overview',
    title: 'Overview',
    icon: BookOpen,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    subsections: [
      {
        id: 'what-is',
        title: 'What Is RFE Foam Pro?',
        content: (
          <>
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>RFE Foam Pro</strong> is an enterprise-grade Progressive Web App (PWA) designed for spray foam insulation contractors.
              It provides a complete business management suite — from estimation and scheduling through invoicing and financial reporting — all in one installable application that works on desktop, tablet, and mobile.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { icon: Calculator, label: 'Estimate Jobs', desc: 'Geometry-based spray foam calculator' },
                { icon: Users, label: 'Manage Customers', desc: 'Built-in CRM with full history' },
                { icon: Warehouse, label: 'Track Inventory', desc: 'Chemical sets, supplies & equipment' },
                { icon: FileText, label: 'Generate PDFs', desc: 'Estimates, work orders & invoices' },
                { icon: HardHat, label: 'Dispatch Crews', desc: 'Mobile-first crew dashboard' },
                { icon: TrendingUp, label: 'Track Profitability', desc: 'Per-job P&L & margin analysis' },
                { icon: Wrench, label: 'Maintain Equipment', desc: 'Interval-based maintenance tracking' },
                { icon: Package, label: 'Order Materials', desc: 'Auto-detect shortages & PO generation' },
              ].map(({ icon: I, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                  <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0"><I className="w-4 h-4 text-brand" /></div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        id: 'roles',
        title: 'User Roles',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">RFE Foam Pro has two distinct user roles:</p>
            <TableSimple headers={['Role', 'Access', 'Description']} rows={[
              ['Admin', 'Full access', 'Business owners and office staff. See all pricing, financials, and management tools.'],
              ['Crew', 'Work orders only', 'Field technicians. Touch-optimized view. No pricing visible. Can start/stop jobs, log material usage, and submit completion reports.'],
            ]} />
          </>
        ),
      },
    ],
  },

  // 2 — Getting Started
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Play,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    subsections: [
      {
        id: 'install',
        title: 'Installing the App (PWA)',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">RFE Foam Pro is a Progressive Web App — it works in your browser but can be <strong>installed</strong> like a native app for the best experience.</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">Desktop (Chrome / Edge)</span>
                </div>
                <StepList steps={[
                  'Visit the app URL in your browser',
                  'Look for the "Install Now" button (pulsing red) in the sidebar or a browser install icon in the address bar',
                  'Click Install in the prompt',
                  'The app opens in its own window — no browser tabs needed',
                ]} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">Mobile (Android)</span>
                </div>
                <StepList steps={[
                  'Open the app in Chrome',
                  'Tap the "Install Now" button or use Chrome\'s "Add to Home Screen" option from the menu',
                  'The app icon appears on your home screen',
                ]} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-900">Mobile (iOS / iPadOS)</span>
                </div>
                <StepList steps={[
                  'Open the app in Safari',
                  'Tap the Share button (square with arrow)',
                  'Tap "Add to Home Screen"',
                  'The app runs in full-screen standalone mode',
                ]} />
              </div>
            </div>
            <InfoBox type="tip" title="Pro Tip">
              Installing the app gives you faster load times, offline access, and a native app experience.
            </InfoBox>
          </>
        ),
      },
      {
        id: 'create-account',
        title: 'Creating an Account',
        content: (
          <>
            <StepList steps={[
              'On the login screen, click "Don\'t have an account? Sign up"',
              'Fill in your Company Name, Full Name, Email, and Password (min 6 characters)',
              'Click "Create Account"',
              'Your organization is automatically created with a unique Company ID and default settings',
            ]} />
          </>
        ),
      },
      {
        id: 'login',
        title: 'Logging In — Admin vs Crew',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">The login screen has <strong>two tabs</strong>:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-bold text-sky-900">Admin Access</span>
                </div>
                <ul className="text-sm text-sky-800 space-y-1">
                  <li>• Enter your <strong>Email</strong> and <strong>Password</strong></li>
                  <li>• Click <strong>"Sign In"</strong></li>
                  <li>• Full access to all features</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <HardHat className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-900">Crew Login</span>
                </div>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Enter the <strong>Company Name</strong></li>
                  <li>• Enter the <strong>Crew Access PIN</strong> (6-digit code)</li>
                  <li>• Click <strong>"Access Jobs"</strong></li>
                  <li>• Opens simplified Crew Dashboard</li>
                </ul>
              </div>
            </div>
            <InfoBox type="note">
              Crew members do not need individual accounts. All crew share the same PIN within an organization.
            </InfoBox>
          </>
        ),
      },
      {
        id: 'walkthrough',
        title: 'First-Time Setup & Guided Tour',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">When you first log in, the app launches an <strong>11-step guided walkthrough</strong> that introduces every section:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['Welcome', 'Dashboard', 'Create New', 'Customers', 'Calculator', 'Warehouse', 'Workflow', 'Settings', 'Profile', 'Sync', 'Complete'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-700">{step}</span>
                </div>
              ))}
            </div>
            <InfoBox type="tip">
              You can <strong>skip</strong> the tour at any time or <strong>replay</strong> it later from Settings → "Replay App Tour".
            </InfoBox>
          </>
        ),
      },
    ],
  },

  // 3 — Navigation
  {
    id: 'navigation',
    title: 'Navigation & Layout',
    icon: Menu,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    subsections: [
      {
        id: 'desktop-sidebar',
        title: 'Desktop Sidebar',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">The left sidebar (270px) is your primary navigation and includes:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-brand shrink-0 mt-0.5" /> <strong>RFE Logo</strong> — Click to return to Dashboard</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-brand shrink-0 mt-0.5" /> <strong>"Create New" button</strong> — Opens Quick Action menu</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-brand shrink-0 mt-0.5" /> <strong>Navigation sections</strong> (collapsible): Main, Jobs & CRM, Inventory & Equipment, Account</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-brand shrink-0 mt-0.5" /> <strong>Install App button</strong> — Appears when PWA install prompt is available</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-brand shrink-0 mt-0.5" /> <strong>User footer</strong> — Company name, Company ID (click to copy), Sync status, Sign Out</li>
            </ul>
          </>
        ),
      },
      {
        id: 'mobile-nav',
        title: 'Mobile Bottom Navigation',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">On mobile, a 5-tab bottom bar provides quick access:</p>
            <TableSimple headers={['Tab', 'Icon', 'Destination']} rows={[
              ['Home', '🏠', 'Dashboard'],
              ['CRM', '👥', 'Customers'],
              ['+ (FAB)', '➕', 'Quick Action Menu'],
              ['Equip', '📦', 'Warehouse'],
              ['More', '☰', 'Full navigation drawer'],
            ]} />
            <InfoBox type="note">
              The <strong>center FAB</strong> (floating action button) is a raised circular button that opens the Quick Action menu with New Customer, New Estimate, and Generate Invoice options.
            </InfoBox>
          </>
        ),
      },
      {
        id: 'notifications',
        title: 'Notifications & Sync Status',
        content: (
          <>
            <ul className="text-sm text-slate-700 space-y-2">
              <li className="flex items-start gap-2"><Bell className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <strong>Toast Notifications</strong> appear in the top-right corner. Green for success, red for errors. Auto-dismiss after 2 seconds.</li>
              <li className="flex items-start gap-2"><RefreshCw className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" /> <strong>Sync Status</strong> in the sidebar shows: Syncing…, Synced, Offline, or Active.</li>
            </ul>
          </>
        ),
      },
    ],
  },

  // 4 — Dashboard
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-brand',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    subsections: [
      {
        id: 'inventory-banner',
        title: 'Inventory Health Banner',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">A prominent banner at the top shows your current chemical stock:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge color="bg-emerald-100 text-emerald-700">🟢 Green — 5+ sets (Healthy)</Badge>
              <Badge color="bg-amber-100 text-amber-700">🟡 Amber — &lt;5 sets (Low)</Badge>
              <Badge color="bg-red-100 text-red-700">🔴 Red — 0 or negative (Critical)</Badge>
            </div>
            <p className="text-sm text-slate-600">Displays Open Cell sets, Closed Cell sets, and Pipeline Demand. Click the banner to navigate directly to the Warehouse.</p>
          </>
        ),
      },
      {
        id: 'operations',
        title: 'Operations Tab — Job Pipeline',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">Four clickable filter cards let you quickly focus your job list:</p>
            <TableSimple headers={['Filter', 'Shows']} rows={[
              ['Active Pipeline', 'All non-archived jobs with total dollar value'],
              ['Review Needed', 'Completed work orders awaiting invoice'],
              ['In Progress', 'Jobs currently being worked by a crew'],
              ['Pending Payment', 'Invoiced jobs awaiting payment'],
            ]} />
            <p className="text-sm text-slate-700 mt-3 mb-2"><strong>Job Status Badges:</strong></p>
            <div className="flex flex-wrap gap-2">
              <Badge color="bg-slate-100 text-slate-600">Draft</Badge>
              <Badge color="bg-sky-100 text-sky-700">Work Order</Badge>
              <Badge color="bg-amber-100 text-amber-700">Crew Started</Badge>
              <Badge color="bg-blue-100 text-blue-700">In Progress</Badge>
              <Badge color="bg-orange-100 text-orange-700">Review Needed</Badge>
              <Badge color="bg-emerald-100 text-emerald-700">Invoiced</Badge>
              <Badge color="bg-green-100 text-green-700">Paid</Badge>
            </div>
          </>
        ),
      },
      {
        id: 'pnl',
        title: 'Profit & Loss Tab — Financials',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">Four top-level financial metrics:</p>
            <TableSimple headers={['Metric', 'Description']} rows={[
              ['Total Sold Revenue', 'Sum of all sold/invoiced/paid jobs'],
              ['Est. Net Profit', 'Revenue minus all costs (green if positive, red if negative)'],
              ['Gross Margin', 'Profit as a percentage of revenue (target: 40%+)'],
              ['Cost Breakdown', 'Visual bar comparing Materials vs. Labor costs'],
            ]} />
            <p className="text-sm text-slate-700 mt-3 mb-2"><strong>Margin Color Coding:</strong></p>
            <div className="flex flex-wrap gap-2">
              <Badge color="bg-emerald-100 text-emerald-700">🟢 30%+ Healthy</Badge>
              <Badge color="bg-amber-100 text-amber-700">🟡 15–30% Watch</Badge>
              <Badge color="bg-red-100 text-red-700">🔴 &lt;15% Attention</Badge>
            </div>
          </>
        ),
      },
    ],
  },

  // 5 — Calculator
  {
    id: 'calculator',
    title: 'Estimate Calculator',
    icon: Calculator,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    subsections: [
      {
        id: 'calc-modes',
        title: 'Calculation Modes',
        content: (
          <>
            <TableSimple headers={['Mode', 'Use Case', 'Inputs']} rows={[
              ['Full Building', 'Complete structure (walls + roof)', 'Length, Width, Wall Height, Roof Pitch'],
              ['Walls Only', 'Wall insulation jobs', 'Length (linear feet), Wall Height'],
              ['Flat Area', 'Attics, slabs, flat surfaces', 'Length, Width, optional Pitch'],
            ]} />
            <InfoBox type="tip">Choose the mode that best matches your job scope. You can add <strong>Additional Sections</strong> for complex buildings with multiple wings.</InfoBox>
          </>
        ),
      },
      {
        id: 'dimensions',
        title: 'Building Dimensions',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Enter building measurements based on your selected mode:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• <strong>Length</strong> (ft) — Building length</li>
              <li>• <strong>Width</strong> (ft) — Building width</li>
              <li>• <strong>Wall Height</strong> (ft) — Wall height</li>
              <li>• <strong>Roof Pitch</strong> — Enter as "X/12" (e.g., "4/12") or degrees</li>
            </ul>
            <p className="text-sm text-slate-700 mt-3 mb-1"><strong>Options:</strong></p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• <strong>Include Gable Ends</strong> — Adds triangular gable wall area (Full Building mode)</li>
              <li>• <strong>Metal Surface</strong> — Applies +15% area increase for corrugated metal ridges</li>
            </ul>
          </>
        ),
      },
      {
        id: 'insulation',
        title: 'Insulation Specifications',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3"><strong>Pricing Mode Toggle:</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-xl border border-sky-200 bg-sky-50">
                <span className="text-sm font-bold text-sky-900">Cost Plus</span>
                <p className="text-xs text-sky-700 mt-1">Price = Material cost + Labor + Expenses</p>
              </div>
              <div className="p-3 rounded-xl border border-violet-200 bg-violet-50">
                <span className="text-sm font-bold text-violet-900">SqFt Price</span>
                <p className="text-xs text-violet-700 mt-1">Price = Area × rate per square foot</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Configure <strong>Wall</strong> and <strong>Roof/Ceiling</strong> settings independently with Foam Type (Open/Closed Cell), Depth (inches), Waste %, and Price Per Sq Ft.</p>
          </>
        ),
      },
      {
        id: 'prep-inventory',
        title: 'Prep & Inventory',
        content: (
          <>
            <StepList steps={[
              'Click "Add Item" in the Prep & Inventory section',
              'Choose from Quick Add from Warehouse (auto-fills name, unit, cost) or "+ Create New Item"',
              'Set the Quantity needed for this job',
              'Each item shows its line cost (Qty × Unit Cost)',
              'Remove items with the trash button',
            ]} />
          </>
        ),
      },
      {
        id: 'labor-fees',
        title: 'Labor, Fees & Results',
        content: (
          <>
            <KeyValue label="Man Hours" value="Expected labor hours (multiplied by labor rate in Settings)" />
            <KeyValue label="Trip / Fuel" value="Travel and fuel costs" />
            <p className="text-sm text-slate-700 mt-3 mb-2">The <strong>Results Summary</strong> card shows calculations in real time:</p>
            <TableSimple headers={['Metric', 'Description']} rows={[
              ['Total Spray Area', 'Combined wall + roof square footage'],
              ['Total Volume', 'Board footage (area × thickness × waste)'],
              ['Chemical Sets', 'Open Cell and Closed Cell sets required (with stroke counts)'],
              ['Total Estimate', 'Final price for the customer'],
              ['COGS Material', 'Your material cost'],
              ['COGS Labor & Misc', 'Labor hours × rate + trip/fuel + other fees'],
              ['Projected Margin', '(Revenue - Costs) / Revenue × 100%'],
            ]} />
          </>
        ),
      },
    ],
  },

  // 6 — Job Workflow
  {
    id: 'workflow',
    title: 'Job Workflow',
    icon: ClipboardList,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    subsections: [
      {
        id: 'lifecycle',
        title: 'Estimate to Payment Lifecycle',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">Every job follows a consistent lifecycle:</p>
            <Workflow steps={[
              { label: 'Estimate', done: true },
              { label: 'Sold', done: true },
              { label: 'Scheduled', active: true },
              { label: 'Invoiced' },
              { label: 'Paid' },
            ]} />
          </>
        ),
      },
      {
        id: 'step-1',
        title: 'Step 1: Draft Estimate',
        content: (
          <>
            <StepList steps={[
              'Build the estimate in the Calculator',
              'Click "Save / Update" — saves as a Draft',
              'The job appears on your Dashboard',
            ]} />
          </>
        ),
      },
      {
        id: 'step-2',
        title: 'Step 2: Finalize Estimate (PDF)',
        content: (
          <>
            <StepList steps={[
              'From the Calculator or Dashboard, click "Finalize & Send"',
              'Opens the Estimate Stage editor with auto-generated line items',
              'Edit any line item — change descriptions, quantities, amounts',
              'Add custom line items or delete items you don\'t want',
              'Click "Save & Continue" to generate the Estimate PDF',
            ]} />
            <InfoBox type="info">The PDF is automatically saved to the customer's document library in the cloud.</InfoBox>
          </>
        ),
      },
      {
        id: 'step-3',
        title: 'Step 3: Mark Sold → Work Order',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Click <strong>"Mark Sold"</strong> from the Estimate Detail view. What happens automatically:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Chemical sets are <strong>deducted from warehouse</strong></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Inventory items are <strong>deducted from warehouse</strong></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Equipment is marked as <strong>"In Use"</strong></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Material usage is <strong>logged</strong> for reporting</li>
            </ul>
          </>
        ),
      },
      {
        id: 'step-4-5-6',
        title: 'Steps 4–6: Work Order, Invoice & Payment',
        content: (
          <>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                <span className="text-sm font-bold text-amber-900">Step 4: Finalize Work Order</span>
                <p className="text-xs text-amber-700 mt-1">Set scheduled date, add crew instructions. Job scope and load list are auto-populated. No pricing shown — this is for crew use. Generate Work Order PDF.</p>
              </div>
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                <span className="text-sm font-bold text-emerald-900">Step 5: Generate Invoice</span>
                <p className="text-xs text-emerald-700 mt-1">After work is completed, review crew actuals (actual hours, sets used, notes). Set invoice number, date, and payment terms. Generate Invoice PDF.</p>
              </div>
              <div className="p-4 rounded-xl border border-green-200 bg-green-50">
                <span className="text-sm font-bold text-green-900">Step 6: Record Payment</span>
                <p className="text-xs text-green-700 mt-1">Click "Mark Paid" — status changes to Paid, financials are calculated, and a Receipt PDF is generated with "PAID IN FULL" stamp.</p>
              </div>
            </div>
          </>
        ),
      },
    ],
  },

  // 7 — PDF Documents
  {
    id: 'pdf',
    title: 'PDF Document Builder',
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    subsections: [
      {
        id: 'doc-types',
        title: 'Document Types',
        content: (
          <>
            <TableSimple headers={['Type', 'Color', 'Use Case']} rows={[
              ['Estimate', 'Blue', 'Customer-facing price quotes'],
              ['Work Order', 'Amber', 'Crew dispatch documents (no pricing)'],
              ['Invoice', 'Green', 'Payment requests'],
            ]} />
          </>
        ),
      },
      {
        id: 'editing-tabs',
        title: 'Editing & Tabs',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">The builder has <strong>four tabs</strong>:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { tab: '1. Document Info', desc: 'Document number, date, company details, logo' },
                { tab: '2. Customer / Job', desc: 'Customer info, job site address' },
                { tab: '3. Line Items', desc: 'Editable table: Qty, Unit, Price, Total' },
                { tab: '4. Notes & Terms', desc: 'Notes, Terms & Conditions, Thank You message' },
              ].map(({ tab, desc }) => (
                <div key={tab} className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-sm font-bold text-slate-900">{tab}</span>
                  <p className="text-xs text-slate-500 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </>
        ),
      },
      {
        id: 'export-cloud',
        title: 'Exporting & Cloud Storage',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Click <strong>"Export"</strong> to generate and download the PDF. Every generated PDF is <strong>automatically saved</strong> to Supabase cloud storage:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• Organized by organization → customer → document type</li>
              <li>• Accessible from the customer's detail view in the CRM</li>
              <li>• Includes metadata: type, date, file size, associated estimate</li>
            </ul>
          </>
        ),
      },
    ],
  },

  // 8 — CRM
  {
    id: 'crm',
    title: 'Customer Database (CRM)',
    icon: Users,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    subsections: [
      {
        id: 'add-customer',
        title: 'Adding a Customer',
        content: (
          <>
            <StepList steps={[
              'Navigate to Customers from the sidebar',
              'Click "Add Lead" (or use Quick Action → New Customer)',
              'Fill in Full Name (required), Address, Phone, and Email',
              'Click Save',
            ]} />
          </>
        ),
      },
      {
        id: 'customer-detail',
        title: 'Customer Detail View',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Click any customer to see their full profile:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• <strong>Contact information</strong> — name, phone, email, address</li>
              <li>• <strong>"Edit Lead"</strong> — modify customer details</li>
              <li>• <strong>"Start Estimate"</strong> — jump to Calculator with this customer selected</li>
              <li>• <strong>Job History</strong> — table of all associated jobs with date, status, quote value</li>
              <li>• <strong>Document Library</strong> — all PDFs generated for this customer (open, download, delete)</li>
            </ul>
          </>
        ),
      },
      {
        id: 'archiving',
        title: 'Archiving Customers',
        content: (
          <>
            <p className="text-sm text-slate-700">Click <strong>"Archive"</strong> to remove a customer from active lists. Archived customers don't appear in dropdown selectors but all job history and documents are preserved.</p>
          </>
        ),
      },
    ],
  },

  // 9 — Warehouse
  {
    id: 'warehouse',
    title: 'Warehouse & Inventory',
    icon: Warehouse,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    subsections: [
      {
        id: 'chemical-sets',
        title: 'Chemical Sets (Foam Stock)',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">Two prominent controls for your chemical stock — <strong>Open Cell</strong> and <strong>Closed Cell</strong>:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• Current set count displayed prominently</li>
              <li>• <strong>+/−</strong> buttons to adjust by 0.25 sets</li>
              <li>• Direct number input for exact values</li>
            </ul>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge color="bg-emerald-100 text-emerald-700">🟢 5+ sets — Healthy</Badge>
              <Badge color="bg-amber-100 text-amber-700">🟡 &lt;5 sets — Low</Badge>
              <Badge color="bg-red-100 text-red-700">🔴 Zero/Negative — Shortage!</Badge>
            </div>
          </>
        ),
      },
      {
        id: 'general-inventory',
        title: 'General Inventory & Equipment',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2"><strong>General Inventory:</strong> Consumable supplies (plastic sheeting, tape, nozzles, etc.) with name, quantity, unit, and cost/unit. Add, edit inline, or delete items.</p>
            <p className="text-sm text-slate-700 mt-3 mb-2"><strong>Tracked Equipment:</strong> Switch to the Equipment tab to manage tools and machinery. Each item shows name and last-known location.</p>
          </>
        ),
      },
      {
        id: 'auto-deductions',
        title: 'Automatic Deductions',
        content: (
          <>
            <InfoBox type="info" title="When a job is marked as Sold:">
              Chemical sets are deducted, inventory items are deducted, and equipment status is updated to "In Use". If a job is re-processed, only the <strong>delta</strong> is applied.
            </InfoBox>
          </>
        ),
      },
    ],
  },

  // 10 — Material Orders
  {
    id: 'material-orders',
    title: 'Material Orders & POs',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    subsections: [
      {
        id: 'shortages-po',
        title: 'Shortage Detection & Purchase Orders',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">The Material Order screen automatically scans your warehouse for negative quantities. A red <strong>Shortage Alert</strong> panel lists every item with negative stock.</p>
            <StepList steps={[
              'Navigate to Material Order from the Warehouse or Dashboard',
              'Enter Vendor Name and Order Date',
              'Add items using quick-add buttons (Open Cell, Closed Cell, or from inventory)',
              'Set Description, Quantity, and Unit Cost per line item',
              'Add Internal Notes (shipping instructions, PO references)',
              'Click "Save Order & Update Stock" — stock is automatically restocked and a PO PDF is generated',
            ]} />
          </>
        ),
      },
    ],
  },

  // 11 — Material Report
  {
    id: 'material-report',
    title: 'Material Usage Report',
    icon: BarChart3,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    subsections: [
      {
        id: 'ledger',
        title: 'Viewing & Exporting the Ledger',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-3">The Material Report shows a chronological log of all material usage:</p>
            <TableSimple headers={['Column', 'Description']} rows={[
              ['Date', 'When the material was used/logged'],
              ['Customer', 'Which job consumed the material'],
              ['Material', 'Material name (Open Cell, Closed Cell, or inventory item)'],
              ['Qty', 'Amount used (with unit)'],
              ['Logged By', 'Who recorded the usage'],
            ]} />
            <InfoBox type="tip">Use the <strong>month picker</strong> to filter by period, then click <strong>"Export Ledger"</strong> to generate a professional PDF report for accounting, tax records, or supplier negotiations.</InfoBox>
          </>
        ),
      },
    ],
  },

  // 12/13 — Equipment
  {
    id: 'equipment',
    title: 'Equipment & Maintenance',
    icon: Wrench,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    subsections: [
      {
        id: 'tracker',
        title: 'Equipment Tracker',
        content: (
          <>
            <p className="text-sm text-slate-700">Shows where each piece of tracked equipment was last used — including customer name (job site), date, and crew member. Items with no usage history show a placeholder.</p>
            <InfoBox type="tip">Quickly find a tool by checking which job site it was last dispatched to.</InfoBox>
          </>
        ),
      },
      {
        id: 'maintenance',
        title: 'Maintenance Tracking',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Interval-based maintenance tracking triggered by chemical sets sprayed and operating hours:</p>
            <StepList steps={[
              'Click "Add Equipment" — enter name, description, category, and status',
              'Add service items with interval in sets or hours (whichever threshold is reached first)',
              'Progress bars show how close each service is to its due date (Green → Amber → Red)',
              'Click "Service Done" when maintenance is performed — counter resets to zero',
            ]} />
            <p className="text-sm text-slate-700 mt-3"><strong>Job Usage Sync:</strong> Click "Sync Jobs" to import completed estimates and apply pending usage to all equipment counters.</p>
          </>
        ),
      },
    ],
  },

  // 14 — Crew Dashboard
  {
    id: 'crew',
    title: 'Crew Dashboard',
    icon: HardHat,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    subsections: [
      {
        id: 'crew-login',
        title: 'Logging In as Crew',
        content: (
          <>
            <StepList steps={[
              'On the login page, select the "Crew Login" tab',
              'Enter the Company Name and Crew Access PIN (provided by admin)',
              'Tap "Access Jobs" — the Crew Dashboard opens with assigned work orders',
            ]} />
            <InfoBox type="warning">Crew members <strong>cannot see pricing</strong> — all costs, totals, and financial data are hidden.</InfoBox>
          </>
        ),
      },
      {
        id: 'work-orders-crew',
        title: 'Viewing Work Orders & Starting Jobs',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">Each work order shows: work order number, customer name, city/state, scheduled date, and status. Tap to open detail view:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• <strong>Client & Location</strong> — customer name and full address</li>
              <li>• <strong>Install Specs</strong> — wall/roof foam type, thickness, sqft</li>
              <li>• <strong>Truck Load List</strong> — chemical sets (with stroke counts), inventory, equipment</li>
              <li>• <strong>Job Notes</strong> — highlighted instructions (gate codes, hazards)</li>
              <li>• <strong>GPS Map</strong> — opens Google Maps for turn-by-turn navigation</li>
              <li>• <strong>View Sheet</strong> — opens the Work Order PDF</li>
            </ul>
          </>
        ),
      },
      {
        id: 'time-clock',
        title: 'Time Clock & Job Completion',
        content: (
          <>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                <span className="text-sm font-bold text-emerald-900">Starting a Job</span>
                <p className="text-xs text-emerald-700 mt-1">Tap "Start Job" (green button) — starts the timer and notifies the office. Timer displays HH:MM:SS and persists across app refreshes.</p>
              </div>
              <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                <span className="text-sm font-bold text-red-900">Completing a Job</span>
                <p className="text-xs text-red-700 mt-1">Tap "Complete Job" — the Completion Modal appears. Enter actual labor hours, material usage (OC/CC sets), machine counters, inventory used, and crew notes. Tap "Submit & Finish".</p>
              </div>
            </div>
            <InfoBox type="note">Completion data syncs to the cloud and appears on the admin's Dashboard as <strong>"Review Needed"</strong>.</InfoBox>
          </>
        ),
      },
    ],
  },

  // 15/16 — Settings & Profile
  {
    id: 'settings-profile',
    title: 'Settings & Profile',
    icon: Settings,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    subsections: [
      {
        id: 'yields-costs',
        title: 'Material Yields & Unit Costs',
        content: (
          <>
            <TableSimple headers={['Setting', 'Default', 'Description']} rows={[
              ['Open Cell Yield', '16,000 bdft', 'Board feet per set of open cell foam'],
              ['Closed Cell Yield', '4,000 bdft', 'Board feet per set of closed cell foam'],
              ['OC Strokes/Set', '6,600', 'Machine stroke count per open cell set'],
              ['CC Strokes/Set', '6,600', 'Machine stroke count per closed cell set'],
              ['Open Cell Cost', '$2,000/set', 'Your cost per set of open cell foam'],
              ['Closed Cell Cost', '$2,600/set', 'Your cost per set of closed cell foam'],
              ['Labor Rate', '$85/hr', 'Cost per labor hour (used in COGS calculations)'],
            ]} />
            <InfoBox type="info">Click <strong>"Save Settings"</strong> to apply. All future estimates will use the new values.</InfoBox>
          </>
        ),
      },
      {
        id: 'branding',
        title: 'Company Branding & Profile',
        content: (
          <>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• <strong>Logo Upload</strong> — Drag and drop or click to upload (max 5MB). Appears on all PDFs.</li>
              <li>• <strong>Company Name</strong> — displayed on documents and in the app header</li>
              <li>• <strong>Business Address, Phone, Email</strong> — appears on generated documents</li>
              <li>• <strong>Company ID</strong> — unique, read-only identifier. Click to copy and share with crew.</li>
              <li>• <strong>Crew Access PIN</strong> — numeric PIN for crew login. Click "Update" to change immediately.</li>
            </ul>
            <InfoBox type="warning" title="Security">All crew members share the same PIN. Change it periodically or when crew membership changes.</InfoBox>
          </>
        ),
      },
    ],
  },

  // 17 — Cloud Sync
  {
    id: 'sync',
    title: 'Cloud Sync & Offline',
    icon: Wifi,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    subsections: [
      {
        id: 'realtime-sync',
        title: 'Real-Time Sync',
        content: (
          <>
            <p className="text-sm text-slate-700 mb-2">RFE Foam Pro uses <strong>Supabase Realtime</strong> for live data synchronization:</p>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li>• Changes sync automatically within seconds</li>
              <li>• When another user updates data, your app receives the update in real-time</li>
              <li>• Click <strong>"Sync Updates"</strong> on the Dashboard to force a full sync</li>
            </ul>
          </>
        ),
      },
      {
        id: 'offline',
        title: 'Offline Fallback',
        content: (
          <>
            <ul className="text-sm text-slate-700 space-y-1.5">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> All data is backed up to <strong>localStorage</strong> on every save</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> If the cloud connection fails, the app loads from localStorage</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Changes made offline will sync when connectivity returns</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> The app remains <strong>fully functional offline</strong> for viewing and editing</li>
            </ul>
          </>
        ),
      },
    ],
  },

  // 18 — Subscriptions
  {
    id: 'subscriptions',
    title: 'Subscription Plans',
    icon: CreditCard,
    color: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-50',
    borderColor: 'border-fuchsia-200',
    subsections: [
      {
        id: 'plans',
        title: 'Available Plans',
        content: (
          <>
            <TableSimple headers={['Plan', 'Price/mo', 'Estimates', 'Customers', 'Storage']} rows={[
              ['Free Trial', '$0', '10/mo', '25', '100 MB'],
              ['Starter', '$49', '50/mo', '100', '500 MB'],
              ['Pro', '$99', '500/mo', '500', '2 GB'],
              ['Enterprise', '$249', 'Unlimited', 'Unlimited', '10 GB'],
            ]} />
            <InfoBox type="info">When you approach plan limits, a banner appears on the Dashboard with usage stats and an "Upgrade Plan" button.</InfoBox>
          </>
        ),
      },
    ],
  },

  // 19 — Tips
  {
    id: 'tips',
    title: 'Tips & Best Practices',
    icon: Lightbulb,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    subsections: [
      {
        id: 'workflow-tips',
        title: 'Estimation Workflow',
        content: (
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Always create the customer first</strong> — this links all documents and history</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Use "Quick Add from Warehouse"</strong> for inventory items — it keeps costs consistent</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Check the Projected Margin</strong> before sending estimates — aim for 40%+</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Use Additional Sections</strong> for complex buildings with multiple wings</li>
          </ul>
        ),
      },
      {
        id: 'inventory-tips',
        title: 'Inventory Management',
        content: (
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Keep chemical sets updated</strong> — the Dashboard warns about shortages</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Review Material Report monthly</strong> — track usage trends and waste</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Use Purchase Orders</strong> to restock — they auto-update warehouse quantities</li>
          </ul>
        ),
      },
      {
        id: 'execution-tips',
        title: 'Job Execution & Financials',
        content: (
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Install the PWA on crew tablets</strong> — better performance than browser</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Add detailed job notes</strong> — gate codes, hazards help crews</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Mark jobs as Paid promptly</strong> — keeps your P&L accurate</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Compare estimated vs. actual</strong> on Invoice Stage — crew actuals show real usage</li>
            <li className="flex items-start gap-2"><Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" /> <strong>Track all proportioners & rigs</strong> — maintenance intervals prevent costly breakdowns</li>
          </ul>
        ),
      },
    ],
  },

  // 20 — Troubleshooting
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: HelpCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    subsections: [
      {
        id: 'faq',
        title: 'Common Issues & Solutions',
        content: (
          <div className="space-y-4">
            {[
              { q: "Can't log in?", a: 'Admin: Verify email and password. Use "Forgot Password" if available. Crew: Confirm Company Name and PIN with your administrator (both are case-sensitive).' },
              { q: 'Data not syncing?', a: 'Check the sync status indicator. Try "Sync Updates" on the Dashboard. Ensure you have internet. Data is always saved locally as backup.' },
              { q: 'PDF not generating?', a: 'Ensure all required fields are filled (customer, line items). Check that your logo is under 5MB. Try a different browser if issues persist.' },
              { q: 'Chemical sets showing negative?', a: 'This means you\'ve sold more than you have in stock. Update actual stock in the Warehouse or create a Material Order to restock.' },
              { q: "Crew can't see work orders?", a: 'Ensure the job status is "Work Order" (not Draft). Crew should tap "Refresh List" or wait for auto-sync (45 seconds). Verify correct Company Name and PIN.' },
              { q: 'Equipment not tracking location?', a: 'Equipment must be assigned to a job in the Calculator\'s Equipment section. Location updates happen when converted to a Work Order.' },
              { q: 'App running slowly?', a: 'Clear old/completed estimates by archiving paid jobs. Use pagination to limit visible items. Ensure the PWA is installed for best performance.' },
            ].map(({ q, a }) => (
              <div key={q} className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-slate-900">{q}</span>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
];


// ─── Main Component ─────────────────────────────────────────────
const UserManual: React.FC = () => {
  const sections = buildSections();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileTOC, setShowMobileTOC] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Back to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    setShowMobileTOC(false);
    // Expand all subsections when navigating
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      const newExpanded = new Set(expandedSubs);
      section.subsections.forEach(sub => newExpanded.add(`${sectionId}-${sub.id}`));
      setExpandedSubs(newExpanded);
    }
    setTimeout(() => {
      const el = sectionRefs.current[sectionId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [sections, expandedSubs]);

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Search filtering
  const filteredSections = searchQuery.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.subsections.some(sub => sub.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sections;

  return (
    <div className="max-w-6xl mx-auto" ref={contentRef}>
      {/* ─── Hero Header ─── */}
      <AnimatedCard>
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-10 mb-6 md:mb-8">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-4 right-4 md:top-6 md:right-8">
            <BookOpen className="w-16 h-16 md:w-24 md:h-24 text-white/5" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-brand px-2 py-0.5 -skew-x-12 transform">
                <span className="skew-x-12 font-black text-xs text-white tracking-wider">RFE</span>
              </div>
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Foam Pro</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tight">
              User Manual
            </h1>
            <p className="text-sm md:text-base text-white/60 max-w-2xl leading-relaxed">
              Complete guide to the RFE Foam Pro Enterprise Spray Foam Estimation & Rig Management Suite. 
              Everything you need to master every feature of the application.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Version 2.0</span>
              <span className="text-white/20">•</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">February 2026</span>
            </div>
            <div className="mt-4"><FeedbackButton area="User Manual" /></div>
          </div>
        </div>
      </AnimatedCard>

      {/* ─── Search Bar ─── */}
      <AnimatedCard delay={100}>
        <div className="mb-6 md:mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search the manual..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </AnimatedCard>

      {/* ─── Mobile TOC Toggle ─── */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setShowMobileTOC(!showMobileTOC)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand" />
            Table of Contents
          </span>
          {showMobileTOC ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showMobileTOC && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3 shadow-lg max-h-[60vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeSectionId === section.id ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">{section.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* ─── Desktop Sidebar TOC ─── */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">Contents</h3>
              <nav className="space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto pr-1 scrollbar-thin">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-[13px] ${
                      activeSectionId === section.id
                        ? `${section.bgColor} ${section.color} font-bold`
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'
                    }`}
                  >
                    <section.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <div className="flex-1 min-w-0 space-y-6 md:space-y-8">
          {filteredSections.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-semibold">No sections match your search.</p>
              <p className="text-sm text-slate-400 mt-1">Try a different keyword.</p>
            </div>
          )}

          {filteredSections.map((section, sectionIndex) => (
            <AnimatedCard key={section.id} delay={sectionIndex * 50}>
              <div
                ref={el => { sectionRefs.current[section.id] = el; }}
                className="scroll-mt-24"
              >
                {/* Section Header */}
                <button
                  onClick={() => {
                    if (activeSectionId === section.id) {
                      setActiveSectionId(null);
                    } else {
                      setActiveSectionId(section.id);
                      // Expand all subsections
                      const newExpanded = new Set(expandedSubs);
                      section.subsections.forEach(sub => newExpanded.add(`${section.id}-${sub.id}`));
                      setExpandedSubs(newExpanded);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 md:p-5 rounded-2xl border transition-all duration-300 group ${
                    activeSectionId === section.id
                      ? `${section.bgColor} ${section.borderColor} shadow-md`
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    activeSectionId === section.id ? `${section.bgColor} ${section.color}` : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                  }`}>
                    <section.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h2 className={`text-base md:text-lg font-black tracking-tight transition-colors ${
                      activeSectionId === section.id ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                    }`}>
                      {section.title}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {section.subsections.length} topic{section.subsections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${
                    activeSectionId === section.id ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Subsections - animated reveal */}
                <div className={`overflow-hidden transition-all duration-500 ease-out ${
                  activeSectionId === section.id ? 'max-h-[5000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                }`}>
                  <div className="space-y-2 md:space-y-3 pl-2 md:pl-4">
                    {section.subsections.map((sub) => {
                      const subKey = `${section.id}-${sub.id}`;
                      const isExpanded = expandedSubs.has(subKey);
                      return (
                        <div key={sub.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-sm">
                          <button
                            onClick={() => toggleSub(subKey)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                          >
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                            <span className="text-sm font-bold text-slate-800">{sub.title}</span>
                          </button>
                          <div className={`transition-all duration-400 ease-out overflow-hidden ${isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                              {sub.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AnimatedCard>
          ))}

          {/* ─── Footer ─── */}
          <AnimatedCard delay={200}>
            <div className="text-center py-8 md:py-12 border-t border-slate-200 mt-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="bg-brand px-2 py-0.5 -skew-x-12 transform">
                  <span className="skew-x-12 font-black text-xs text-white tracking-wider">RFE</span>
                </div>
                <span className="text-sm font-bold text-slate-400">Foam Pro</span>
              </div>
              <p className="text-xs text-slate-400">
                © RFE Equipment — RFE Foam Pro Enterprise Suite
              </p>
              <p className="text-xs text-slate-400 mt-1">
                For support, visit <a href="https://rfrequipment.com" className="text-brand hover:underline font-semibold" target="_blank" rel="noopener noreferrer">rfrequipment.com</a>
              </p>
            </div>
          </AnimatedCard>
        </div>
      </div>

      {/* ─── Scroll to Top Button ─── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[50] w-12 h-12 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-brand transition-all duration-300 active:scale-90 animate-in fade-in slide-in-from-bottom-4"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default UserManual;
