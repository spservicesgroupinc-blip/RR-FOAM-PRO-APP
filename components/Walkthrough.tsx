import React, { useEffect } from 'react';
import { useWalkthrough, WalkthroughStep } from '../context/WalkthroughContext';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  SkipForward,
  Sparkles,
  LayoutDashboard,
  Plus,
  Users,
  Calculator,
  Warehouse,
  ArrowRightLeft,
  Settings,
  User,
  Cloud,
  PartyPopper
} from 'lucide-react';

interface WalkthroughOverlayProps {
  onNavigate?: (view: string) => void;
}

// Map step IDs to lucide icons
const stepIcons: Record<string, React.ReactNode> = {
  welcome: <Sparkles className="w-8 h-8" />,
  dashboard: <LayoutDashboard className="w-8 h-8" />,
  create_new: <Plus className="w-8 h-8" />,
  customers: <Users className="w-8 h-8" />,
  calculator: <Calculator className="w-8 h-8" />,
  warehouse: <Warehouse className="w-8 h-8" />,
  workflow: <ArrowRightLeft className="w-8 h-8" />,
  settings: <Settings className="w-8 h-8" />,
  profile: <User className="w-8 h-8" />,
  sync: <Cloud className="w-8 h-8" />,
  complete: <PartyPopper className="w-8 h-8" />,
};

// Color themes per step for visual variety
const stepThemes: Record<string, { bg: string; iconBg: string; iconText: string; accent: string }> = {
  welcome:    { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-brand/20',     iconText: 'text-brand',       accent: 'bg-brand' },
  dashboard:  { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-sky-500/20',   iconText: 'text-sky-400',     accent: 'bg-sky-500' },
  create_new: { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-brand/20',     iconText: 'text-brand',       accent: 'bg-brand' },
  customers:  { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-violet-500/20',iconText: 'text-violet-400',  accent: 'bg-violet-500' },
  calculator: { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400',   accent: 'bg-amber-500' },
  warehouse:  { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', accent: 'bg-emerald-500' },
  workflow:   { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-orange-500/20',iconText: 'text-orange-400',  accent: 'bg-orange-500' },
  settings:   { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-slate-500/20', iconText: 'text-slate-300',   accent: 'bg-slate-500' },
  profile:    { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-indigo-500/20',iconText: 'text-indigo-400',  accent: 'bg-indigo-500' },
  sync:       { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-cyan-500/20',  iconText: 'text-cyan-400',    accent: 'bg-cyan-500' },
  complete:   { bg: 'from-slate-900 to-slate-800', iconBg: 'bg-brand/20',     iconText: 'text-brand',       accent: 'bg-brand' },
};

export const WalkthroughOverlay: React.FC<WalkthroughOverlayProps> = ({ onNavigate }) => {
  const { 
    isActive, 
    currentStep, 
    currentStepIndex, 
    totalSteps, 
    nextStep, 
    prevStep, 
    skipWalkthrough 
  } = useWalkthrough();

  // Navigate to the target view when step changes
  useEffect(() => {
    if (isActive && currentStep?.targetView && onNavigate) {
      onNavigate(currentStep.targetView);
    }
  }, [isActive, currentStep, onNavigate]);

  if (!isActive || !currentStep) return null;

  const theme = stepThemes[currentStep.id] || stepThemes.welcome;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Card */}
      <div 
        className={`relative w-full max-w-md bg-gradient-to-b ${theme.bg} rounded-3xl shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10 w-full">
          <div 
            className={`h-full ${theme.accent} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip button */}
        {!isLast && (
          <button 
            onClick={skipWalkthrough}
            className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-white/80 transition-colors z-10 px-3 py-1.5 rounded-full hover:bg-white/10"
          >
            Skip Tour
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Content */}
        <div className="px-8 pt-10 pb-6 text-center">
          {/* Step counter */}
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 mb-6">
            Step {currentStepIndex + 1} of {totalSteps}
          </div>

          {/* Icon */}
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl ${theme.iconBg} ${theme.iconText} mb-6`}>
            {stepIcons[currentStep.id] || <Sparkles className="w-8 h-8" />}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-black text-white mb-3 tracking-tight">
            {currentStep.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
            {currentStep.description}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStepIndex 
                  ? `w-6 ${theme.accent}` 
                  : i < currentStepIndex 
                    ? 'w-1.5 bg-white/30' 
                    : 'w-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8 flex items-center gap-3">
          {!isFirst && (
            <button 
              onClick={prevStep}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          
          <button 
            onClick={nextStep}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-95 ${
              isLast 
                ? 'bg-brand hover:bg-brand-hover text-white shadow-lg shadow-red-900/30' 
                : 'bg-white text-slate-900 hover:bg-white/90 shadow-lg'
            }`}
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Small button to replay the walkthrough — used in Settings */
export const ReplayWalkthroughButton: React.FC = () => {
  const { startWalkthrough } = useWalkthrough();

  return (
    <button 
      onClick={startWalkthrough}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all active:scale-95"
    >
      <Sparkles className="w-4 h-4 text-brand" />
      Replay App Tour
    </button>
  );
};
