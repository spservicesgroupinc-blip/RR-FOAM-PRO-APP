
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    LogOut, RefreshCw, MapPin, Calendar, HardHat, FileText,
    ChevronLeft, CheckCircle2, Package, AlertTriangle, User,
    ArrowRight, Play, Square, Clock, Save, Loader2, Download,
    MessageSquare, History, Zap, RotateCcw, MousePointerClick
} from 'lucide-react';
import { CalculatorState, EstimateRecord } from '../types';
import { crewUpdateJob } from '../services/supabaseService';
import safeStorage from '../utils/safeStorage';
import { FeedbackButton } from './FeedbackButton';

interface CrewDashboardProps {
  state: CalculatorState;
  organizationId: string;
  onLogout: () => void;
  syncStatus: string;
  onSync: () => Promise<void>; // This is forceRefresh (Sync Down) now passed from parent
  installPrompt: any;
  onInstall: () => void;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({ state, organizationId, onLogout, syncStatus, onSync, installPrompt, onInstall }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [jobStartTime, setJobStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSyncingTime, setIsSyncingTime] = useState(false);
  
  // Completion Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [actuals, setActuals] = useState({
      openCellSets: 0,
      closedCellSets: 0,
      openCellStrokes: 0,
      closedCellStrokes: 0,
      laborHours: 0,
      inventory: [] as any[],
      notes: ''
  });
  const [isCompleting, setIsCompleting] = useState(false);

  // ── STROKE COUNTER STATE ─────────────────────────────────────────────
  const [liveOCStrokes, setLiveOCStrokes] = useState(0);
  const [liveCCStrokes, setLiveCCStrokes] = useState(0);
  const [activeStrokeType, setActiveStrokeType] = useState<'oc' | 'cc'>('oc');
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const strokeFlashRef = useRef<HTMLDivElement>(null);

  // Strokes per set: prefer job-locked ratio from materials, fallback to user Settings
  const selectedJobForRatio = state.savedEstimates.find(e => e.id === selectedJobId);
  const ocStrokesPerSet = selectedJobForRatio?.materials?.ocStrokesPerSet || state.yields?.openCellStrokes || 6600;
  const ccStrokesPerSet = selectedJobForRatio?.materials?.ccStrokesPerSet || state.yields?.closedCellStrokes || 6600;

  // Persist stroke counts per job to localStorage
  const strokeStorageKey = (jobId: string, type: string) => `foamPro_strokeCount_${jobId}_${type}`;

  // Load stroke counts when a job is selected
  useEffect(() => {
    if (selectedJobId) {
      try {
        const savedOC = safeStorage.getItem(strokeStorageKey(selectedJobId, 'oc'));
        const savedCC = safeStorage.getItem(strokeStorageKey(selectedJobId, 'cc'));
        setLiveOCStrokes(savedOC ? parseInt(savedOC, 10) : 0);
        setLiveCCStrokes(savedCC ? parseInt(savedCC, 10) : 0);
      } catch { /* storage unavailable */ }
    }
  }, [selectedJobId]);

  // Save stroke counts whenever they change
  useEffect(() => {
    if (selectedJobId && (liveOCStrokes > 0 || liveCCStrokes > 0)) {
      try {
        safeStorage.setItem(strokeStorageKey(selectedJobId, 'oc'), liveOCStrokes.toString());
        safeStorage.setItem(strokeStorageKey(selectedJobId, 'cc'), liveCCStrokes.toString());
      } catch { /* storage unavailable */ }
    }
  }, [selectedJobId, liveOCStrokes, liveCCStrokes]);

  // Stroke increment handler — used by click AND keyboard/USB input
  const incrementStroke = useCallback((type?: 'oc' | 'cc') => {
    const target = type || activeStrokeType;
    if (target === 'oc') {
      setLiveOCStrokes(prev => prev + 1);
    } else {
      setLiveCCStrokes(prev => prev + 1);
    }
    setLastClickTime(Date.now());
    // Visual flash feedback
    if (strokeFlashRef.current) {
      strokeFlashRef.current.classList.remove('animate-ping-once');
      void strokeFlashRef.current.offsetWidth; // force reflow
      strokeFlashRef.current.classList.add('animate-ping-once');
    }
  }, [activeStrokeType]);

  const resetStrokes = useCallback((type: 'oc' | 'cc') => {
    if (!selectedJobId) return;
    if (window.confirm(`Reset ${type === 'oc' ? 'Open Cell' : 'Closed Cell'} stroke counter to 0?`)) {
      if (type === 'oc') {
        setLiveOCStrokes(0);
        safeStorage.setItem(strokeStorageKey(selectedJobId, 'oc'), '0');
      } else {
        setLiveCCStrokes(0);
        safeStorage.setItem(strokeStorageKey(selectedJobId, 'cc'), '0');
      }
    }
  }, [selectedJobId]);

  // Keyboard listener for USB HID stroke counters (sends Enter/Space/digit keys)
  // Also supports: F9 = OC stroke, F10 = CC stroke (configurable for USB devices)
  useEffect(() => {
    if (!isTimerRunning || !selectedJobId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Space bar or Enter = increment active type
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        incrementStroke();
      }
      // F9 = Open Cell stroke
      if (e.code === 'F9') {
        e.preventDefault();
        incrementStroke('oc');
      }
      // F10 = Closed Cell stroke
      if (e.code === 'F10') {
        e.preventDefault();
        incrementStroke('cc');
      }
      // Tab = switch active type
      if (e.code === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setActiveStrokeType(prev => prev === 'oc' ? 'cc' : 'oc');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTimerRunning, selectedJobId, incrementStroke]);

  // ── GLOBAL MOUSE CLICK → STROKE (simulates USB/ESP32 sensor input) ──
  // When the timer is running, ANY left-click anywhere = +1 stroke.
  // Only skip: control buttons (back/pause/complete/type-switch/reset), inputs, and the completion modal.
  useEffect(() => {
    if (!isTimerRunning || !selectedJobId || showCompletionModal) return;

    const handleGlobalClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Left-click only
      const target = e.target as HTMLElement;
      if (!target) return;

      // Skip completion modal
      if (target.closest('[data-completion-modal]')) return;

      // Skip only specific crew-control buttons (marked with data-no-stroke)
      if (target.closest('[data-no-stroke]')) return;

      // Skip form inputs where user is typing
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Everything else counts as a stroke!
      incrementStroke();
    };

    // Use capture phase so we get the click before any button stopPropagation
    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, [isTimerRunning, selectedJobId, showCompletionModal, incrementStroke]);

  // --- AUTOMATIC BACKGROUND SYNC ---
  useEffect(() => {
    // Poll for new jobs every 45 seconds
    const syncInterval = setInterval(() => {
        // Skip sync only during completion flow (modal open or submitting)
        // to prevent UI disruption while entering actuals.
        // Timer-running state is safe because timer/stroke state lives in
        // local useState and is not affected by the context data refresh.
        if (!showCompletionModal && !isCompleting) {
            console.log("Auto-syncing crew dashboard...");
            onSync();
        }
    }, 45000);

    return () => clearInterval(syncInterval);
  }, [showCompletionModal, isCompleting, onSync]);

  // Restore timer state on load
  useEffect(() => {
      try {
        const savedStart = safeStorage.getItem('foamPro_crewStartTime');
        const savedJobId = safeStorage.getItem('foamPro_crewActiveJob');
        
        if (savedStart && savedJobId) {
            setJobStartTime(savedStart);
            setIsTimerRunning(true);
            setSelectedJobId(savedJobId);
        }
      } catch { /* storage unavailable */ }
  }, []);

  // Timer Tick
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isTimerRunning && jobStartTime) {
          interval = setInterval(() => {
              const start = new Date(jobStartTime).getTime();
              const now = new Date().getTime();
              setElapsedSeconds(Math.floor((now - start) / 1000));
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isTimerRunning, jobStartTime]);

  const formatTime = (secs: number) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  // Resolve the organization ID from localStorage, falling back to the prop.
  // iOS WebKit can evict the React state under memory pressure while localStorage
  // retains the value (or vice-versa), so we always reconcile from storage first.
  const resolveSessionOrgId = (): string => {
    try {
      const s = safeStorage.getItem('foamProCrewSession') || safeStorage.getItem('foamProSession');
      if (s) {
        const parsed = JSON.parse(s);
        return parsed.organizationId || organizationId;
      }
    } catch { /* use prop fallback */ }
    return organizationId;
  };

  const activeWorkOrders = state.savedEstimates.filter(e => e.status === 'Work Order' && e.executionStatus !== 'Completed');
  const completedWorkOrders = state.savedEstimates.filter(e => e.status === 'Work Order' && e.executionStatus === 'Completed');
  
  const displayedJobs = showHistory ? completedWorkOrders : activeWorkOrders;
  const selectedJob = selectedJobId ? state.savedEstimates.find(j => j.id === selectedJobId) : null;

  const handleStartTimer = async () => {
      const now = new Date().toISOString();
      setJobStartTime(now);
      setIsTimerRunning(true);
      try {
        safeStorage.setItem('foamPro_crewStartTime', now);
        if (selectedJobId) safeStorage.setItem('foamPro_crewActiveJob', selectedJobId);
      } catch { /* iOS storage full — timer still works in memory */ }

      // Notify backend that crew started the job (with retry via crewUpdateJob)
      try {
          if (selectedJobId) {
              const success = await crewUpdateJob(
                  resolveSessionOrgId(),
                  selectedJobId,
                  { startedAt: now, startedBy: 'Crew' },
                  'In Progress'
              );
              if (success) {
                  console.log('Backend notified: job started');
              } else {
                  console.warn('Backend notification queued for retry');
              }
          }
      } catch (e) {
          console.warn('Failed to notify backend of job start:', e);
      }
  };

  const handleStopTimer = async (isCompletion: boolean) => {
      if (!selectedJob || !jobStartTime) return;
      
      try {
          const endTime = new Date().toISOString();
          setIsSyncingTime(true);
          
          const sessionDurationHours = (new Date(endTime).getTime() - new Date(jobStartTime).getTime()) / (1000 * 60 * 60);

          // Log crew time to estimate actuals
          if (selectedJob.id) {
            let user = "Crew";
            try {
                // Check both session keys — iOS can evict one or both
                const s = safeStorage.getItem('foamProCrewSession') || safeStorage.getItem('foamProSession');
                if (s) {
                  const parsed = JSON.parse(s);
                  user = parsed.username || parsed.companyName || 'Crew';
                }
            } catch(e) {
                console.warn("Could not retrieve session user for timer log");
            }
            
            await crewUpdateJob(
              resolveSessionOrgId(),
              selectedJob.id,
              { 
                ...selectedJob.actuals, 
                lastTimeLog: { start: jobStartTime, end: endTime, user, hours: sessionDurationHours } 
              },
              selectedJob.executionStatus || 'In Progress'
            );
          }

          // Clear local state
          setIsTimerRunning(false);
          setJobStartTime(null);
          setElapsedSeconds(0);
          try {
            safeStorage.removeItem('foamPro_crewStartTime');
            safeStorage.removeItem('foamPro_crewActiveJob');
          } catch { /* storage unavailable */ }
          
          if (isCompletion) {
              const estLabor = selectedJob.expenses?.manHours || 0;
              // Safe access to materials and inventory
              const estInventory = selectedJob.materials?.inventory ? [...selectedJob.materials.inventory] : [];
              const ocSets = selectedJob.materials?.openCellSets || 0;
              const ccSets = selectedJob.materials?.closedCellSets || 0;
              
              // Auto-populate stroke counts from the live counter
              // Use ?? to preserve legitimate 0 values
              const finalOCStrokes = liveOCStrokes || (selectedJob.actuals?.openCellStrokes ?? 0);
              const finalCCStrokes = liveCCStrokes || (selectedJob.actuals?.closedCellStrokes ?? 0);

              // Calculate actual sets from live stroke counts if available
              // Use nullish coalescing (??) instead of || to preserve legitimate 0 values
              const actualOCSets = liveOCStrokes > 0 
                ? round2(liveOCStrokes / ocStrokesPerSet) 
                : (selectedJob.actuals?.openCellSets ?? round2(ocSets));
              const actualCCSets = liveCCStrokes > 0 
                ? round2(liveCCStrokes / ccStrokesPerSet) 
                : (selectedJob.actuals?.closedCellSets ?? round2(ccSets));

              setActuals({
                  openCellSets: actualOCSets,
                  closedCellSets: actualCCSets,
                  openCellStrokes: finalOCStrokes,
                  closedCellStrokes: finalCCStrokes,
                  laborHours: selectedJob.actuals?.laborHours ?? round2(parseFloat((estLabor || sessionDurationHours).toFixed(2))),
                  inventory: selectedJob.actuals?.inventory ?? estInventory,
                  notes: selectedJob.actuals?.notes ?? ''
              });
              setShowCompletionModal(true);
          }
      } catch (e: any) {
          alert(`Error updating timer: ${e.message}`);
      } finally {
          setIsSyncingTime(false);
      }
  };

  const handleCompleteJobSubmit = async () => {
      if (!selectedJob) return;
      setIsCompleting(true);
      
      try {
        // Resolve session credentials, falling back to the prop if storage is unavailable.
        const sessionOrgId = resolveSessionOrgId();
        if (!sessionOrgId) throw new Error("Session expired. Please log out and back in.");

        let sessionUser = 'Crew';
        try {
          const sessionStr = safeStorage.getItem('foamProCrewSession') || safeStorage.getItem('foamProSession');
          if (sessionStr) {
            const parsed = JSON.parse(sessionStr);
            sessionUser = parsed.username || parsed.companyName || 'Crew';
          }
        } catch { /* use default */ }
        
        const finalData = {
            ...actuals,
            ocStrokesPerSet,
            ccStrokesPerSet,
            completionDate: new Date().toISOString(),
            completedBy: sessionUser
        };

        const success = await crewUpdateJob(sessionOrgId, selectedJob.id, finalData, 'Completed');
        
        if (success) {
            // Clear stroke counter localStorage for this job
            safeStorage.removeItem(strokeStorageKey(selectedJob.id, 'oc'));
            safeStorage.removeItem(strokeStorageKey(selectedJob.id, 'cc'));
            setLiveOCStrokes(0);
            setLiveCCStrokes(0);

            setShowCompletionModal(false);
            setSelectedJobId(null);
            
            // Sync DOWN to get the latest status from server (Completed)
            // This prevents local "In Progress" state from overwriting the server
            setTimeout(async () => {
                try {
                    await onSync(); // This calls forceRefresh (Sync Down)
                    alert("Job Completed Successfully!");
                } catch(e) {
                    console.error("Sync failed after completion", e);
                    // Show a non-destructive error instead of reloading the app
                    alert("Job was saved successfully, but the refresh failed. Please pull to refresh.");
                }
            }, 1000);
        } else {
            // crewUpdateJob returned false: the update failed but was queued for
            // offline retry.  Let the crew know so they can try again when connected.
            alert("Could not submit job — it has been queued for retry. Please check your connection and tap 'Submit & Finish' again when back online.");
        }
      } catch (error: any) {
         console.error("Completion Error:", error);
         alert(`An error occurred: ${error.message || "Unknown error"}`);
      } finally {
         setIsCompleting(false);
      }
  };

  const RFESmallLogo = () => (
    <div className="flex items-center gap-2 select-none">
        <div className="bg-brand text-white px-1.5 py-0.5 -skew-x-12 transform origin-bottom-left shadow-sm flex items-center justify-center">
            <span className="skew-x-12 font-black text-lg tracking-tighter">RFE</span>
        </div>
        <div className="flex flex-col justify-center -space-y-0.5">
            <span className="text-xl font-black italic tracking-tighter text-slate-900 leading-none">RFE</span>
            <span className="text-[0.4rem] font-bold tracking-[0.2em] text-brand-yellow bg-black px-1 py-0.5 leading-none">FOAM EQUIPMENT</span>
        </div>
    </div>
  );

  // --- JOB DETAIL VIEW ---
  if (selectedJob) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 animate-in slide-in-from-right-4 duration-300">
            {/* Same detail view logic as before ... keeping it consistent */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
                    <button 
                        data-no-stroke
                        onClick={() => !isTimerRunning && setSelectedJobId(null)} 
                        disabled={isTimerRunning}
                        className={`flex items-center gap-2 font-bold transition-colors ${isTimerRunning ? 'text-slate-300' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <ChevronLeft className="w-5 h-5" />
                        </div>
                        <span className="text-sm uppercase tracking-wider">Back</span>
                    </button>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Work Order</div>
                        <div className="text-lg font-black text-slate-900">#{selectedJob.id.substring(0,8).toUpperCase()}</div>
                    </div>
                </div>
                
                {/* Time Clock Bar */}
                <div className={`p-4 ${isTimerRunning ? 'bg-red-50 border-b border-red-100' : 'bg-slate-50 border-b border-slate-100'}`}>
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className={`w-6 h-6 ${isTimerRunning ? 'text-brand animate-pulse' : 'text-slate-400'}`} />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time Clock</div>
                                <div className={`text-xl font-mono font-black ${isTimerRunning ? 'text-brand' : 'text-slate-600'}`}>
                                    {isTimerRunning ? formatTime(elapsedSeconds) : '00:00:00'}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {selectedJob.executionStatus === 'Completed' ? (
                                <button 
                                    onClick={() => {
                                        // Allow editing completion details without timer
                                        setActuals({
                                            openCellSets: selectedJob.actuals?.openCellSets || 0,
                                            closedCellSets: selectedJob.actuals?.closedCellSets || 0,
                                            openCellStrokes: selectedJob.actuals?.openCellStrokes || 0,
                                            closedCellStrokes: selectedJob.actuals?.closedCellStrokes || 0,
                                            laborHours: selectedJob.actuals?.laborHours || 0,
                                            inventory: selectedJob.actuals?.inventory || [],
                                            notes: selectedJob.actuals?.notes || ''
                                        });
                                        setShowCompletionModal(true);
                                    }}
                                    className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
                                >
                                    Edit Details
                                </button>
                            ) : !isTimerRunning ? (
                                <button 
                                    data-no-stroke
                                    onClick={handleStartTimer}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-200"
                                >
                                    <Play className="w-4 h-4 fill-current" /> Start Job
                                </button>
                            ) : (
                                <>
                                    <button 
                                        data-no-stroke
                                        onClick={() => handleStopTimer(false)}
                                        disabled={isSyncingTime}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                                    >
                                        {isSyncingTime ? <Loader2 className="w-4 h-4 animate-spin"/> : "Pause / End Day"}
                                    </button>
                                    <button 
                                        data-no-stroke
                                        onClick={() => handleStopTimer(true)}
                                        disabled={isSyncingTime}
                                        className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-200"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Complete Job
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-6">
                
                {/* Completed Banner */}
                {selectedJob.executionStatus === 'Completed' && (
                    <div className="bg-emerald-100 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800">
                        <CheckCircle2 className="w-6 h-6" />
                        <div>
                            <div className="font-black uppercase text-xs tracking-widest">Job Completed</div>
                            <div className="text-sm">Submitted by {selectedJob.actuals?.completedBy} on {new Date(selectedJob.actuals?.completionDate || "").toLocaleDateString()}</div>
                        </div>
                    </div>
                )}

                {/* ════════════════ LIVE STROKE COUNTER ════════════════ */}
                {/* ALWAYS visible when timer is running — no material conditionals */}
                {isTimerRunning && (
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 relative overflow-hidden">
                    {/* Pulse flash on every click */}
                    <div ref={strokeFlashRef} className="absolute inset-0 bg-brand/10 rounded-3xl pointer-events-none opacity-0" />
                    
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-brand-yellow" /> Live Stroke Counter
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Listening</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mb-4">
                      Every mouse click anywhere = +1 stroke &bull; Tab = switch type &bull; Ready for USB / ESP32 input
                    </p>

                    {/* Type Selector Tabs — always show both */}
                    <div className="flex gap-2 mb-4" data-no-stroke>
                      <button
                        data-no-stroke
                        onClick={() => setActiveStrokeType('oc')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          activeStrokeType === 'oc'
                            ? 'bg-brand text-white shadow-lg shadow-red-900/30'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        Open Cell
                      </button>
                      <button
                        data-no-stroke
                        onClick={() => setActiveStrokeType('cc')}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          activeStrokeType === 'cc'
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-900/30'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        Closed Cell
                      </button>
                    </div>

                    {/* ── Active Counter Display ── */}
                    {activeStrokeType === 'oc' ? (
                      <div className="rounded-2xl border-2 border-brand bg-brand/5">
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-brand">Open Cell — Active</div>
                            <button
                              data-no-stroke
                              onClick={() => resetStrokes('oc')}
                              className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                              title="Reset OC counter"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Big Counter Display */}
                          <div className="w-full rounded-2xl p-8 bg-brand/20 border-2 border-brand/30 text-center select-none">
                            <div className="text-7xl font-black text-white tabular-nums leading-none mb-2">
                              {liveOCStrokes.toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-300 font-bold flex items-center justify-center gap-2">
                              <MousePointerClick className="w-4 h-4" /> STROKES
                            </div>
                          </div>

                          {/* Progress & Sets */}
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                              <span className="text-slate-400">{liveOCStrokes.toLocaleString()} / {ocStrokesPerSet.toLocaleString()} per set</span>
                              <span className="text-brand font-black text-lg">{(liveOCStrokes / ocStrokesPerSet).toFixed(2)} Sets</span>
                            </div>
                            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-brand to-brand-yellow rounded-full transition-all duration-300"
                                style={{ width: `${Math.min((liveOCStrokes % ocStrokesPerSet) / ocStrokesPerSet * 100, 100)}%` }}
                              />
                            </div>
                            {(selectedJob.results?.openCellStrokes ?? 0) > 0 && (
                              <div className="text-xs text-slate-500 font-medium text-right">
                                Estimated: {selectedJob.results.openCellStrokes.toLocaleString()} strokes ({selectedJob.materials?.openCellSets?.toFixed(2)} sets)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-sky-500 bg-sky-500/5">
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-sky-400">Closed Cell — Active</div>
                            <button
                              data-no-stroke
                              onClick={() => resetStrokes('cc')}
                              className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                              title="Reset CC counter"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Big Counter Display */}
                          <div className="w-full rounded-2xl p-8 bg-sky-500/20 border-2 border-sky-500/30 text-center select-none">
                            <div className="text-7xl font-black text-white tabular-nums leading-none mb-2">
                              {liveCCStrokes.toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-300 font-bold flex items-center justify-center gap-2">
                              <MousePointerClick className="w-4 h-4" /> STROKES
                            </div>
                          </div>

                          {/* Progress & Sets */}
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                              <span className="text-slate-400">{liveCCStrokes.toLocaleString()} / {ccStrokesPerSet.toLocaleString()} per set</span>
                              <span className="text-sky-400 font-black text-lg">{(liveCCStrokes / ccStrokesPerSet).toFixed(2)} Sets</span>
                            </div>
                            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min((liveCCStrokes % ccStrokesPerSet) / ccStrokesPerSet * 100, 100)}%` }}
                              />
                            </div>
                            {(selectedJob.results?.closedCellStrokes ?? 0) > 0 && (
                              <div className="text-xs text-slate-500 font-medium text-right">
                                Estimated: {selectedJob.results.closedCellStrokes.toLocaleString()} strokes ({selectedJob.materials?.closedCellSets?.toFixed(2)} sets)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inactive type summary (smaller) */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-black uppercase tracking-widest ${activeStrokeType === 'oc' ? 'text-sky-400' : 'text-brand'}`}>
                          {activeStrokeType === 'oc' ? 'Closed Cell' : 'Open Cell'}
                        </span>
                        <span className="text-white font-black tabular-nums text-base">
                          {activeStrokeType === 'oc' ? liveCCStrokes.toLocaleString() : liveOCStrokes.toLocaleString()} strokes
                        </span>
                        <span className="text-slate-400 font-bold">
                          {activeStrokeType === 'oc' 
                            ? (liveCCStrokes / ccStrokesPerSet).toFixed(2)
                            : (liveOCStrokes / ocStrokesPerSet).toFixed(2)
                          } sets
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-center text-[10px] text-slate-500 font-medium">
                      Input: Mouse clicks &bull; Keyboard (Space/Enter) &bull; USB HID &bull; ESP32 sensor
                    </div>
                  </div>
                )}

                {/* Stroke Summary when paused but has data */}
                {!isTimerRunning && (liveOCStrokes > 0 || liveCCStrokes > 0) && selectedJob.executionStatus !== 'Completed' && (
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-yellow" /> Stroke Count (Paused)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">Open Cell</div>
                        <div className="text-2xl font-black text-slate-900">{liveOCStrokes.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 font-bold">{(liveOCStrokes / ocStrokesPerSet).toFixed(2)} sets</div>
                      </div>
                      <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                        <div className="text-[10px] text-sky-600 font-black uppercase tracking-widest mb-1">Closed Cell</div>
                        <div className="text-2xl font-black text-slate-900">{liveCCStrokes.toLocaleString()}</div>
                        <div className="text-xs text-slate-500 font-bold">{(liveCCStrokes / ccStrokesPerSet).toFixed(2)} sets</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-4" data-no-stroke>
                    <a 
                        data-no-stroke
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.customer.address + ' ' + selectedJob.customer.zip)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-white active:bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <MapPin className="w-6 h-6 text-brand" /> 
                        <span className="font-bold text-sm uppercase tracking-wide">GPS Map</span>
                    </a>
                    {selectedJob.workOrderSheetUrl ? (
                         <a 
                            data-no-stroke
                            href={selectedJob.workOrderSheetUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-white active:bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                             <FileText className="w-6 h-6 text-emerald-600" /> 
                             <span className="font-bold text-sm uppercase tracking-wide">View Sheet</span>
                         </a>
                    ) : (
                         <div className="bg-slate-100 text-slate-400 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border border-slate-200">
                             <FileText className="w-6 h-6" /> 
                             <span className="font-bold text-sm uppercase tracking-wide">No Sheet</span>
                         </div>
                    )}
                </div>

                {/* Customer Info Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Client & Location
                    </h3>
                    <div>
                        <div className="text-2xl font-black text-slate-900 mb-1">{selectedJob.customer.name}</div>
                        <div className="text-slate-500 font-medium text-lg leading-snug">
                            {selectedJob.customer.address}<br/>
                            {selectedJob.customer.city}, {selectedJob.customer.state} {selectedJob.customer.zip}
                        </div>
                    </div>
                </div>

                {/* Scope Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"> 
                        <HardHat className="w-4 h-4"/> Install Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(selectedJob.results?.totalWallArea ?? 0) > 0 && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">Walls</div>
                                <div className="text-slate-900 font-bold text-lg leading-tight">{selectedJob.wallSettings?.type}</div>
                                <div className="text-slate-600 font-medium text-sm mt-1">@ {selectedJob.wallSettings?.thickness}" Depth</div>
                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-400 text-right">{Math.round(selectedJob.results?.totalWallArea ?? 0).toLocaleString()} sqft</div>
                            </div>
                        )}
                        {(selectedJob.results?.totalRoofArea ?? 0) > 0 && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">Roof / Ceiling</div>
                                <div className="text-slate-900 font-bold text-lg leading-tight">{selectedJob.roofSettings?.type}</div>
                                <div className="text-slate-600 font-medium text-sm mt-1">@ {selectedJob.roofSettings?.thickness}" Depth</div>
                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-400 text-right">{Math.round(selectedJob.results?.totalRoofArea ?? 0).toLocaleString()} sqft</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Load List Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Truck Load List
                    </h3>
                    <div className="space-y-3">
                         {selectedJob.materials?.openCellSets > 0 && (
                             <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div>
                                     <span className="font-bold text-slate-700 block">Open Cell Foam</span>
                                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                         Est. {selectedJob.results?.openCellStrokes?.toLocaleString()} Strokes
                                     </span>
                                 </div>
                                 <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-brand font-black shadow-sm">{selectedJob.materials.openCellSets.toFixed(2)} Sets</span>
                             </div>
                         )}
                         {selectedJob.materials?.closedCellSets > 0 && (
                             <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div>
                                     <span className="font-bold text-slate-700 block">Closed Cell Foam</span>
                                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                         Est. {selectedJob.results?.closedCellStrokes?.toLocaleString()} Strokes
                                     </span>
                                 </div>
                                 <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-brand font-black shadow-sm">{selectedJob.materials.closedCellSets.toFixed(2)} Sets</span>
                             </div>
                         )}
                         {selectedJob.materials?.inventory?.map((item) => (
                             <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <span className="font-bold text-slate-700">{item.name}</span>
                                 <span className="text-slate-500 font-bold">{item.quantity} {item.unit}</span>
                             </div>
                         ))}
                    </div>
                </div>

                {/* Notes Card */}
                {selectedJob.notes && (
                    <div className="bg-amber-50 p-6 rounded-3xl shadow-sm border border-amber-100">
                        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Job Notes
                        </h3>
                        <p className="text-amber-900 text-sm font-medium leading-relaxed">
                            {selectedJob.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Completion Modal */}
            {showCompletionModal && (
                <div data-completion-modal className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Complete Job</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Total Labor Hours</label>
                                <input 
                                    type="number" 
                                    value={actuals.laborHours || ''} 
                                    onChange={(e) => setActuals({...actuals, laborHours: parseFloat(e.target.value) || 0})}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-2xl text-center focus:ring-4 focus:ring-brand/20 outline-none"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Material Usage (Sets)</h4>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 flex justify-between mb-1"><span>Open Cell</span> <span>Est: {selectedJob.materials?.openCellSets.toFixed(2)}</span></label>
                                    <input 
                                        type="number" step="0.25"
                                        value={actuals.openCellSets} 
                                        onChange={(e) => {
                                            const sets = parseFloat(e.target.value) || 0;
                                            const derivedStrokes = Math.round(sets * ocStrokesPerSet);
                                            setActuals({...actuals, openCellSets: sets, openCellStrokes: derivedStrokes});
                                        }}
                                        placeholder="0.00"
                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 flex justify-between mb-1"><span>Closed Cell</span> <span>Est: {selectedJob.materials?.closedCellSets.toFixed(2)}</span></label>
                                    <input 
                                        type="number" step="0.25"
                                        value={actuals.closedCellSets} 
                                        onChange={(e) => {
                                            const sets = parseFloat(e.target.value) || 0;
                                            const derivedStrokes = Math.round(sets * ccStrokesPerSet);
                                            setActuals({...actuals, closedCellSets: sets, closedCellStrokes: derivedStrokes});
                                        }}
                                        placeholder="0.00"
                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                    />
                                </div>
                            </div>

                            {/* STROKE COUNTS */}
                            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 space-y-4">
                                <h4 className="text-xs font-black text-sky-900 uppercase tracking-widest border-b border-sky-200 pb-2">Machine Counters (Strokes)</h4>
                                <div>
                                    <label className="text-xs font-bold text-sky-700 flex justify-between mb-1"><span>Open Cell Strokes</span> <span>Est: {selectedJob.results?.openCellStrokes?.toLocaleString()}</span></label>
                                    <input 
                                        type="number"
                                        value={actuals.openCellStrokes || ''} 
                                        onChange={(e) => {
                                            const strokes = parseInt(e.target.value) || 0;
                                            const derivedSets = strokes > 0 ? parseFloat((strokes / ocStrokesPerSet).toFixed(2)) : actuals.openCellSets;
                                            setActuals({...actuals, openCellStrokes: strokes, openCellSets: derivedSets});
                                        }}
                                        placeholder="0"
                                        className="w-full p-4 bg-white border border-sky-200 rounded-xl font-bold text-lg text-sky-900 focus:ring-2 focus:ring-sky-500 outline-none"
                                    />
                                    {actuals.openCellStrokes > 0 && <p className="text-[10px] text-sky-500 mt-1 text-right">= {(actuals.openCellStrokes / ocStrokesPerSet).toFixed(2)} Sets ({ocStrokesPerSet} strokes/set)</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-sky-700 flex justify-between mb-1"><span>Closed Cell Strokes</span> <span>Est: {selectedJob.results?.closedCellStrokes?.toLocaleString()}</span></label>
                                    <input 
                                        type="number"
                                        value={actuals.closedCellStrokes || ''} 
                                        onChange={(e) => {
                                            const strokes = parseInt(e.target.value) || 0;
                                            const derivedSets = strokes > 0 ? parseFloat((strokes / ccStrokesPerSet).toFixed(2)) : actuals.closedCellSets;
                                            setActuals({...actuals, closedCellStrokes: strokes, closedCellSets: derivedSets});
                                        }}
                                        placeholder="0"
                                        className="w-full p-4 bg-white border border-sky-200 rounded-xl font-bold text-lg text-sky-900 focus:ring-2 focus:ring-sky-500 outline-none"
                                    />
                                    {actuals.closedCellStrokes > 0 && <p className="text-[10px] text-sky-500 mt-1 text-right">= {(actuals.closedCellStrokes / ccStrokesPerSet).toFixed(2)} Sets ({ccStrokesPerSet} strokes/set)</p>}
                                </div>
                            </div>

                            {/* INVENTORY ITEMS (Non-Foam Materials) */}
                            {actuals.inventory && actuals.inventory.length > 0 && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
                                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest border-b border-amber-200 pb-2 flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5" /> Inventory Used (Actual)
                                    </h4>
                                    {actuals.inventory.map((item: any, idx: number) => (
                                        <div key={item.id || idx}>
                                            <label className="text-xs font-bold text-amber-700 flex justify-between mb-1">
                                                <span>{item.name}</span>
                                                <span>Est: {(selectedJob.materials?.inventory?.find((e: any) => e.id === item.id || e.name === item.name)?.quantity || 0)} {item.unit || 'ea'}</span>
                                            </label>
                                            <input 
                                                type="number"
                                                step="0.25"
                                                value={item.quantity ?? ''} 
                                                onChange={(e) => {
                                                    const updatedInv = [...actuals.inventory];
                                                    updatedInv[idx] = { ...updatedInv[idx], quantity: parseFloat(e.target.value) || 0 };
                                                    setActuals({ ...actuals, inventory: updatedInv });
                                                }}
                                                placeholder="0"
                                                className="w-full p-4 bg-white border border-amber-200 rounded-xl font-bold text-lg text-amber-900 focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* CREW NOTES */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3"/> Crew Notes / Issues
                                </label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-brand outline-none resize-none h-24"
                                    placeholder="Mention any issues, extra materials used, or specific details for the office..."
                                    value={actuals.notes}
                                    onChange={(e) => setActuals({...actuals, notes: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowCompletionModal(false)} disabled={isCompleting} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50">Cancel</button>
                                <button onClick={handleCompleteJobSubmit} disabled={isCompleting} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 flex items-center justify-center gap-2">
                                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin"/> : "Submit & Finish"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- JOB LIST VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
        
        {/* Floating Install Icon for Crew */}
        {installPrompt && (
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
             <button 
                onClick={onInstall}
                className="group flex items-center gap-3 bg-slate-900 text-white pl-4 pr-6 py-4 rounded-full shadow-2xl border-2 border-slate-700 hover:bg-brand hover:border-brand transition-all hover:scale-105 active:scale-95"
                title="Install Desktop App"
             >
                <div className="bg-white/10 p-1.5 rounded-full group-hover:bg-white/20 transition-colors">
                    <Download className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white/80 transition-colors leading-none mb-0.5">Desktop App</span>
                    <span className="font-bold text-sm leading-none">Install Now</span>
                </div>
             </button>
          </div>
        )}

        {/* Header */}
        <header className="bg-slate-900 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-start mb-6">
                <RFESmallLogo />
                <div className="flex gap-2">
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                            {syncStatus === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin"/> : <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>}
                            {syncStatus === 'syncing' ? 'Syncing...' : 'Live'}
                        </div>
                    </div>
                    {installPrompt && (
                        <button onClick={onInstall} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/40 transition-colors" title="Install App">
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onLogout} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black mb-1">Crew Dashboard</h1>
                    <p className="text-slate-400 text-sm font-medium">Select a Work Order to begin.</p>
                    <div className="mt-2"><FeedbackButton area="Crew Dashboard" /></div>
                </div>
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${showHistory ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'}`}
                >
                    <History className="w-4 h-4" /> {showHistory ? 'Hide History' : 'History'}
                </button>
            </div>
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand rounded-full filter blur-[80px] opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
        </header>

        {/* List */}
        <div className="px-4 -mt-8 relative z-20 space-y-4 max-w-2xl mx-auto">
            {displayedJobs.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center shadow-lg border border-slate-100">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">{showHistory ? 'No Completed Jobs' : 'All Caught Up!'}</h3>
                    <p className="text-slate-500 text-sm">{showHistory ? 'Completed work orders will appear here.' : 'No pending work orders assigned.'}</p>
                    {!showHistory && (
                        <button onClick={() => onSync()} className="mt-6 text-brand font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:underline">
                            <RefreshCw className="w-4 h-4" /> Refresh List
                        </button>
                    )}
                </div>
            ) : (
                displayedJobs.map(job => (
                    <button 
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-left hover:scale-[1.02] transition-transform active:scale-95 group relative overflow-hidden ${job.executionStatus === 'Completed' ? 'opacity-80 hover:opacity-100' : ''}`}
                    >
                        <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${job.executionStatus === 'Completed' ? 'bg-emerald-500' : 'bg-slate-200 group-hover:bg-brand'}`}></div>
                        <div className="flex justify-between items-start mb-4 pl-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    Work Order {job.executionStatus === 'Completed' && <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">DONE</span>}
                                </div>
                                <div className="text-xl font-black text-slate-900">#{job.id.substring(0,8).toUpperCase()}</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-slate-400 group-hover:text-brand transition-colors">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="pl-4 space-y-2">
                             <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <User className="w-4 h-4 text-slate-400" /> {job.customer.name}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                <MapPin className="w-4 h-4 text-slate-400" /> {job.customer.city}, {job.customer.state}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                <Calendar className="w-4 h-4 text-slate-400" /> {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : "Unscheduled"}
                             </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    </div>
  );
};
