
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    LogOut, RefreshCw, MapPin, Calendar, HardHat, FileText,
    ChevronLeft, CheckCircle2, Package, AlertTriangle, User,
    ArrowRight, Play, Square, Clock, Save, Loader2, Download,
    MessageSquare, History, Zap, RotateCcw, Bluetooth
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

  // ── BLUETOOTH AUDIO STATE ─────────────────────────────────────────
  // For BT audio devices (clickers, remotes, headsets) — NOT BLE GATT.
  // Chrome routes media buttons to our app via the Media Session API,
  // but only when we have an active audio element playing.
  const [btConnected, setBtConnected] = useState(false);
  const [btActivating, setBtActivating] = useState(false);
  const btAudioRef = useRef<HTMLAudioElement | null>(null);
  const btAudioCtxRef = useRef<AudioContext | null>(null); // Web Audio API backup for Android
  const btKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const btWakeLockRef = useRef<any>(null); // Screen Wake Lock for tablets
  const [btStrokeLog, setBtStrokeLog] = useState<string[]>([]);  // recent BT events for debugging
  const [btWarning, setBtWarning] = useState<string | null>(null);

  // Detect Samsung Internet or non-Chrome Android browsers
  const isAndroid = /android/i.test(navigator.userAgent);
  const isSamsungBrowser = /SamsungBrowser/i.test(navigator.userAgent);
  const isChromeOnAndroid = isAndroid && /Chrome/i.test(navigator.userAgent) && !isSamsungBrowser;

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

  // Stroke increment handler — used by click AND keyboard/USB/BT input
  const incrementStroke = useCallback((type?: 'oc' | 'cc', source?: string) => {
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
    // Haptic feedback for mobile devices
    try { if (navigator.vibrate) navigator.vibrate(30); } catch { /* not supported */ }
    // Log source for BT debugging
    if (source) {
      setBtStrokeLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()} ${source} → ${target.toUpperCase()}`]);
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

  // ── ACTIVATE BLUETOOTH AUDIO CAPTURE ──
  // When user taps "Activate", we play a silent audio loop. This tells Chrome
  // we have an active media session, so Bluetooth audio device buttons
  // (play/pause, next/prev, volume) get routed to our page as Media Session
  // events instead of controlling system media. No BLE GATT or special
  // Bluetooth permission is needed — the device just needs to be paired
  // at the OS level (phone/computer Bluetooth settings).
  //
  // ANDROID / SAMSUNG FIX: Samsung tablets + Android Chrome have aggressive
  // battery optimization that kills nearly-silent audio. We use:
  //   (a) Higher audio volume (0.05) so the OS treats it as real playback
  //   (b) Web Audio API (AudioContext) as a secondary audio source
  //   (c) Faster keepalive (1s) to re-assert playback
  //   (d) Screen Wake Lock to prevent the tablet sleeping
  //   (e) visibilitychange handler to reclaim session on foreground
  //   (f) Samsung Internet detection + user warning

  const ensureAudioPlaying = useCallback(() => {
    const audio = btAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => { /* user gesture might be needed again */ });
    }
    // Reset position to prevent potential end-of-buffer issues
    audio.currentTime = 0;
    // Reassert playing state so the OS doesn't reclaim the media session
    try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }
    // Resume AudioContext if it was suspended (Android does this on visibility change)
    try {
      if (btAudioCtxRef.current && btAudioCtxRef.current.state === 'suspended') {
        btAudioCtxRef.current.resume();
      }
    } catch { /* ignore */ }
  }, []);

  // Screen Wake Lock — keeps the tablet screen on while BT is active
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        btWakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[BT] Screen Wake Lock acquired');
        // Re-acquire on visibility change (Android releases it when tab goes background)
        btWakeLockRef.current.addEventListener('release', () => {
          console.log('[BT] Wake Lock released');
        });
      }
    } catch (err) {
      console.warn('[BT] Wake Lock not available:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      if (btWakeLockRef.current) {
        btWakeLockRef.current.release();
        btWakeLockRef.current = null;
        console.log('[BT] Wake Lock released manually');
      }
    } catch { /* ignore */ }
  }, []);

  const connectBluetooth = useCallback(async () => {
    setBtActivating(true);
    setBtWarning(null);

    // Warn Samsung Internet users
    if (isSamsungBrowser) {
      setBtWarning(
        'Samsung Internet has limited Bluetooth support. ' +
        'For best results, open this app in Chrome and try again.'
      );
    }

    try {
      // ── 1. HTML Audio element (primary media session claim) ──
      if (!btAudioRef.current) {
        const audio = new Audio();
        // 44-byte WAV: RIFF header + 1 sample of silence
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.loop = true;
        // Android fix: volume 0.01 is too quiet — Samsung's battery optimizer
        // treats it as "not real playback" and kills it. 0.05 is still
        // effectively inaudible but high enough for Android to respect it.
        audio.volume = isAndroid ? 0.05 : 0.01;
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');
        btAudioRef.current = audio;
      }

      // .play() requires a user gesture — that's the "permission" step.
      await btAudioRef.current.play();

      // ── 2. Web Audio API backup (strengthens media session on Android) ──
      // Creating an AudioContext tied to the same user gesture gives Android
      // a stronger signal that this page is "actively playing audio".
      try {
        if (!btAudioCtxRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            // Create a very low-frequency, low-volume oscillator (inaudible)
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.frequency.value = 1; // 1 Hz — below human hearing
            gain.gain.value = 0.001; // essentially silent
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            btAudioCtxRef.current = ctx;
            console.log('[BT] AudioContext backup started (Android media session fix)');
          }
        } else if (btAudioCtxRef.current.state === 'suspended') {
          await btAudioCtxRef.current.resume();
        }
      } catch (audioCtxErr) {
        console.warn('[BT] AudioContext backup not available:', audioCtxErr);
      }

      // ── 3. Label our media session ──
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'RFE Stroke Counter',
          artist: 'Spray Foam Equipment',
          album: 'Stroke Counter Active',
        });
        navigator.mediaSession.playbackState = 'playing';
      }

      // ── 4. Screen Wake Lock (prevents Samsung tablet from sleeping) ──
      await requestWakeLock();

      // ── 5. Keepalive interval — faster on Android (1s vs 3s) ──
      if (btKeepAliveRef.current) clearInterval(btKeepAliveRef.current);
      const keepAliveMs = isAndroid ? 1000 : 3000;
      btKeepAliveRef.current = setInterval(() => {
        ensureAudioPlaying();
      }, keepAliveMs);

      setBtConnected(true);
      setBtStrokeLog([]);
      console.log('[BT] Media session claimed — Bluetooth audio buttons now route to stroke counter');
      if (isAndroid) {
        console.log('[BT] Android mode: higher volume, AudioContext backup, 1s keepalive, Wake Lock');
      }
    } catch (err) {
      console.error('[BT] Activation failed:', err);
      const isAndroidMsg = isAndroid
        ? '\n4. On Samsung tablets: make sure Chrome is the default browser\n' +
          '5. Close other music/media apps that may grab the Bluetooth session\n' +
          '6. Go to Settings → Apps → Chrome → Battery → Unrestricted'
        : '';
      alert(
        'Could not activate Bluetooth audio capture.\n\n' +
        '1. Make sure your Bluetooth device is paired in your phone/computer Settings → Bluetooth\n' +
        '2. Tap the Activate button again\n' +
        '3. Chrome may ask for permission to play audio — tap Allow' +
        isAndroidMsg
      );
    } finally {
      setBtActivating(false);
    }
  }, [ensureAudioPlaying, requestWakeLock, isAndroid, isSamsungBrowser]);

  // ── DEACTIVATE BLUETOOTH ──
  const disconnectBluetooth = useCallback(() => {
    // Stop keepalive interval
    if (btKeepAliveRef.current) {
      clearInterval(btKeepAliveRef.current);
      btKeepAliveRef.current = null;
    }
    if (btAudioRef.current) {
      btAudioRef.current.pause();
      btAudioRef.current.currentTime = 0;
    }
    // Close AudioContext backup
    try {
      if (btAudioCtxRef.current) {
        btAudioCtxRef.current.close();
        btAudioCtxRef.current = null;
      }
    } catch { /* ignore */ }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'stop'];
      for (const action of actions) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
      }
    }
    // Release Screen Wake Lock
    releaseWakeLock();
    setBtConnected(false);
    setBtWarning(null);
    setBtStrokeLog([]);
    console.log('[BT] Bluetooth audio capture deactivated');
  }, [releaseWakeLock]);

  // ── MEDIA SESSION HANDLERS (BT audio buttons → strokes) ──
  // Maps ALL common Bluetooth audio device buttons to stroke increments.
  // Covers: play/pause, next/prev track, seek forward/back, stop.
  useEffect(() => {
    if (!btConnected || !isTimerRunning || !selectedJobId || showCompletionModal) return;
    if (!('mediaSession' in navigator)) return;

    // Helper: increment stroke, keep audio alive, and reassert playback state
    const btIncrement = (actionName: string) => {
      incrementStroke(undefined, `BT:${actionName}`);
      // Always keep audio playing — some BT events (pause/stop) halt playback
      ensureAudioPlaying();
    };

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play',           () => btIncrement('play')],
      ['pause',          () => btIncrement('pause')],
      ['nexttrack',      () => btIncrement('next')],
      ['previoustrack',  () => btIncrement('prev')],
      ['seekforward',    () => btIncrement('seekfwd')],    // some remotes/earbuds use seek
      ['seekbackward',   () => btIncrement('seekback')],   // some remotes/earbuds use seek
      ['stop',           () => btIncrement('stop')],        // stop button on some devices
    ];

    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported in this browser */ }
    }
    try { navigator.mediaSession.playbackState = 'playing'; } catch { /* ignore */ }

    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
      }
    };
  }, [btConnected, isTimerRunning, selectedJobId, showCompletionModal, incrementStroke, ensureAudioPlaying]);

  // Clean up audio, AudioContext, keepalive, and Wake Lock on unmount
  useEffect(() => {
    return () => {
      if (btAudioRef.current) btAudioRef.current.pause();
      try { if (btAudioCtxRef.current) btAudioCtxRef.current.close(); } catch { /* ignore */ }
      if (btKeepAliveRef.current) {
        clearInterval(btKeepAliveRef.current);
        btKeepAliveRef.current = null;
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // ── VISIBILITY CHANGE HANDLER (Android fix) ──
  // When the Samsung tablet screen turns off or the user switches apps,
  // Android suspends audio and releases the media session.  When the
  // user returns, we re-assert playback and re-acquire the Wake Lock.
  useEffect(() => {
    if (!btConnected) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && btConnected) {
        console.log('[BT] Page visible again — re-asserting audio and media session');
        ensureAudioPlaying();
        // Re-acquire Wake Lock (Android releases it on visibility change)
        await requestWakeLock();
        // Small delay then re-assert again (Android sometimes needs a moment)
        setTimeout(() => ensureAudioPlaying(), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [btConnected, ensureAudioPlaying, requestWakeLock]);

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
      // Bluetooth audio device media keys → increment active stroke type
      // Most BT clickers/remotes send MediaPlayPause, MediaTrackNext, or MediaTrackPrevious
      if (e.code === 'MediaPlayPause' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        incrementStroke();
      }
      if (e.code === 'MediaTrackNext' || e.key === 'MediaTrackNext') {
        e.preventDefault();
        incrementStroke();
      }
      if (e.code === 'MediaTrackPrevious' || e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        incrementStroke();
      }
      // Volume buttons (some BT devices send these)
      if (e.code === 'AudioVolumeUp' || e.key === 'AudioVolumeUp') {
        e.preventDefault();
        incrementStroke();
      }
      if (e.code === 'AudioVolumeDown' || e.key === 'AudioVolumeDown') {
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
        <div className="bg-orange-600 text-white px-2 py-0.5 flex items-center justify-center">
            <span className="font-mono font-bold text-base tracking-tight">RFE</span>
        </div>
        <div className="flex flex-col justify-center">
            <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 leading-none uppercase">Foam Equipment</span>
        </div>
    </div>
  );

  // --- JOB DETAIL VIEW ---
  if (selectedJob) {
      return (
        <div className="min-h-screen bg-gray-900 text-white pb-28 crew-detail-root">
            <div className="bg-gray-800 border-b-2 border-gray-600 sticky top-0 z-30">
                <div className="max-w-3xl mx-auto px-3 py-2 flex justify-between items-center crew-header-bar">
                    <button 
                        data-no-stroke
                        onClick={() => !isTimerRunning && setSelectedJobId(null)} 
                        disabled={isTimerRunning}
                        className={`flex items-center gap-1 font-mono font-bold text-sm transition-colors ${isTimerRunning ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="uppercase tracking-wider">Back</span>
                    </button>
                    <div className="text-right font-mono">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Work Order</div>
                        <div className="text-base font-bold text-orange-500">#{selectedJob.id.substring(0,8).toUpperCase()}</div>
                    </div>
                </div>
                
                {/* Time Clock Bar */}
                <div className={`px-3 py-2 border-b-2 crew-timer-bar ${isTimerRunning ? 'bg-[#2a1015] border-red-900' : 'bg-[#172032] border-gray-700'}`}>
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className={`w-5 h-5 ${isTimerRunning ? 'text-red-500' : 'text-gray-600'}`} />
                            <div>
                                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Time Clock</div>
                                <div className={`text-2xl font-mono font-bold tracking-wider ${isTimerRunning ? 'text-red-500' : 'text-gray-600'}`}>
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
                                    className="bg-gray-700 border border-gray-600 text-white px-5 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-gray-600"
                                >
                                    Edit Details
                                </button>
                            ) : !isTimerRunning ? (
                                <button 
                                    data-no-stroke
                                    onClick={handleStartTimer}
                                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 border border-emerald-600"
                                >
                                    <Play className="w-4 h-4 fill-current" /> Start Job
                                </button>
                            ) : (
                                <>
                                    <button 
                                        data-no-stroke
                                        onClick={() => handleStopTimer(false)}
                                        disabled={isSyncingTime}
                                        className="bg-gray-700 border border-gray-600 text-gray-300 px-4 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-gray-600"
                                    >
                                        {isSyncingTime ? <Loader2 className="w-4 h-4 animate-spin"/> : "Pause / End Day"}
                                    </button>
                                    <button 
                                        data-no-stroke
                                        onClick={() => handleStopTimer(true)}
                                        disabled={isSyncingTime}
                                        className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-sm font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 border border-orange-500"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Complete Job
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-3 py-4 space-y-3 crew-detail-content">
                
                {/* ═══ LEFT PANEL: Stroke Counter (landscape tablet: left column) ═══ */}
                {isTimerRunning && (
                  <div className="crew-stroke-panel bg-gray-800 p-4 border-2 border-gray-600 relative overflow-hidden">
                    {/* Pulse flash on every click */}
                    <div ref={strokeFlashRef} className="absolute inset-0 bg-orange-500/10 pointer-events-none opacity-0" />
                    
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-orange-500" /> Live Stroke Counter
                      </h3>
                      <div className="flex items-center gap-2">
                        {btConnected ? (
                          <>
                            <Bluetooth className="w-3.5 h-3.5 text-blue-500" />
                            <div className="w-2 h-2 bg-blue-500"></div>
                            <span className="text-[10px] text-blue-500 font-mono font-bold uppercase tracking-widest">BT Connected</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-emerald-500"></div>
                            <span className="text-[10px] text-emerald-500 font-mono font-bold uppercase tracking-widest">Listening</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bluetooth Activation */}
                    <div className="mb-3" data-no-stroke>
                      {!btConnected ? (
                        <div className="space-y-2">
                          <button
                            data-no-stroke
                            onClick={connectBluetooth}
                            disabled={btActivating}
                            className="w-full py-2.5 px-4 bg-blue-800 hover:bg-blue-700 disabled:bg-blue-900 disabled:opacity-60 text-white font-mono font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-blue-700"
                          >
                            {btActivating ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Activating...</>
                            ) : (
                              <><Bluetooth className="w-4 h-4" /> Activate Bluetooth Stroke Counter</>
                            )}
                          </button>
                          <div className="bt-instructions">
                            <p className="text-[10px] text-gray-600 text-center font-mono leading-relaxed">
                              <strong>Step 1:</strong> Pair your Bluetooth device in phone/computer Settings → Bluetooth<br/>
                              <strong>Step 2:</strong> Tap the button above to activate stroke counting<br/>
                              Any button press on your BT device will count as a stroke
                            </p>
                            {isAndroid && (
                              <p className="text-[10px] text-yellow-600 text-center font-mono leading-relaxed mt-1">
                                <strong>Android/Tablet tip:</strong> Use Chrome (not Samsung Internet). Close other media apps.
                                {isSamsungBrowser && <><br/><strong className="text-red-500">⚠ Samsung Internet detected</strong> — switch to Chrome for Bluetooth support.</>}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1 py-2 px-3 bg-blue-900/40 border border-blue-800 text-blue-400 font-mono font-bold text-xs flex items-center gap-2">
                              <Bluetooth className="w-4 h-4" />
                              <span>Bluetooth active &mdash; press any button on your device to count strokes</span>
                            </div>
                            <button
                              data-no-stroke
                              onClick={disconnectBluetooth}
                              className="px-3 py-2 bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-400 hover:text-white text-xs font-mono font-bold transition-colors"
                            >
                              Deactivate
                            </button>
                          </div>
                          <p className="text-[10px] text-blue-600 text-center font-mono">
                            Play/Pause • Next/Prev • Seek • Stop • Volume buttons all count as strokes • Space/Enter also works
                          </p>
                          {btWarning && (
                            <div className="mt-1 py-1.5 px-3 bg-yellow-900/40 border border-yellow-800 text-yellow-400 font-mono text-[10px] text-center">
                              ⚠ {btWarning}
                            </div>
                          )}
                          {/* BT Debug Log — last 10 events */}
                          {btStrokeLog.length > 0 && (
                            <div className="mt-2 max-h-20 overflow-y-auto bg-gray-900 border border-gray-700 p-2 bt-debug-log">
                              {btStrokeLog.map((entry, i) => (
                                <div key={i} className="text-[9px] text-gray-600 font-mono leading-relaxed">{entry}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Type Selector Tabs — always show both */}
                    <div className="flex gap-0 mb-4" data-no-stroke>
                      <button
                        data-no-stroke
                        onClick={() => setActiveStrokeType('oc')}
                        className={`flex-1 py-2 px-4 text-xs font-mono font-bold uppercase tracking-widest transition-colors border ${
                          activeStrokeType === 'oc'
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-gray-700 text-gray-500 border-gray-600 hover:bg-gray-700 hover:text-gray-300'
                        }`}
                      >
                        Open Cell
                      </button>
                      <button
                        data-no-stroke
                        onClick={() => setActiveStrokeType('cc')}
                        className={`flex-1 py-2 px-4 text-xs font-mono font-bold uppercase tracking-widest transition-colors border border-l-0 ${
                          activeStrokeType === 'cc'
                            ? 'bg-sky-700 text-white border-sky-600'
                            : 'bg-gray-700 text-gray-500 border-gray-600 hover:bg-gray-700 hover:text-gray-300'
                        }`}
                      >
                        Closed Cell
                      </button>
                    </div>

                    {/* ── Active Counter Display with Estimate Target & Over-Budget Warning ── */}
                    {(() => {
                      // Compute estimate vs actual for the active type
                      const isOC = activeStrokeType === 'oc';
                      const liveStrokes = isOC ? liveOCStrokes : liveCCStrokes;
                      const strokesPerSet = isOC ? ocStrokesPerSet : ccStrokesPerSet;
                      const estimatedStrokes = isOC
                        ? (selectedJob.materials?.openCellStrokes || selectedJob.results?.openCellStrokes || 0)
                        : (selectedJob.materials?.closedCellStrokes || selectedJob.results?.closedCellStrokes || 0);
                      const estimatedSets = isOC
                        ? (selectedJob.materials?.openCellSets || 0)
                        : (selectedJob.materials?.closedCellSets || 0);
                      const liveSets = liveStrokes / strokesPerSet;
                      const pctOfEstimate = estimatedStrokes > 0 ? (liveStrokes / estimatedStrokes) * 100 : 0;
                      const isOverBudget = estimatedStrokes > 0 && liveStrokes > estimatedStrokes;
                      const isNearBudget = estimatedStrokes > 0 && pctOfEstimate >= 85 && !isOverBudget;
                      const overByStrokes = liveStrokes - estimatedStrokes;
                      const overBySets = overByStrokes / strokesPerSet;

                      // Inactive type values
                      const inactiveStrokes = isOC ? liveCCStrokes : liveOCStrokes;
                      const inactiveStrokesPerSet = isOC ? ccStrokesPerSet : ocStrokesPerSet;
                      const inactiveEstimated = isOC
                        ? (selectedJob.materials?.closedCellStrokes || selectedJob.results?.closedCellStrokes || 0)
                        : (selectedJob.materials?.openCellStrokes || selectedJob.results?.openCellStrokes || 0);
                      const inactiveIsOver = inactiveEstimated > 0 && inactiveStrokes > inactiveEstimated;

                      // Colors
                      const accentColor = isOC ? 'orange-600' : 'sky-700';
                      const accentText = isOC ? 'text-orange-500' : 'text-sky-500';
                      const borderColor = isOverBudget ? 'border-red-600' : isNearBudget ? 'border-yellow-600' : (isOC ? 'border-orange-600' : 'border-sky-700');
                      const bgTint = isOverBudget ? 'bg-[#2a1520]' : (isOC ? 'bg-[#2a2010]' : 'bg-[#102a2a]');
                      const counterBg = isOverBudget ? 'bg-red-900/30 border-red-700' : isNearBudget ? 'bg-yellow-900/30 border-yellow-700' : (isOC ? 'bg-orange-900/30 border-orange-700' : 'bg-sky-900/30 border-sky-700');
                      const progressColor = isOverBudget
                        ? 'bg-red-600'
                        : isNearBudget
                          ? 'bg-yellow-600'
                          : (isOC ? 'bg-orange-600' : 'bg-sky-600');

                      return (
                        <>
                          {/* ═══ OVER-BUDGET WARNING BANNER ═══ */}
                          {isOverBudget && (
                            <div className="mb-4 p-3 bg-[#2a1015] border-2 border-red-700 over-budget-banner">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-red-900 border border-red-700">
                                  <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                  <div className="text-sm font-mono font-bold text-red-500 uppercase tracking-wide">
                                    Chemical Over-Usage Warning
                                  </div>
                                  <div className="text-xs text-red-600 font-mono mt-0.5">
                                    {isOC ? 'Open Cell' : 'Closed Cell'} is over the estimated amount
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="p-2 bg-red-900/30 border border-red-800 text-center">
                                  <div className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-widest mb-1">Over By</div>
                                  <div className="text-2xl font-mono font-bold text-red-400 tabular-nums">{overByStrokes.toLocaleString()}</div>
                                  <div className="text-[10px] text-red-600 font-mono">strokes</div>
                                </div>
                                <div className="p-2 bg-red-900/30 border border-red-800 text-center">
                                  <div className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-widest mb-1">Over By</div>
                                  <div className="text-2xl font-mono font-bold text-red-400 tabular-nums">{overBySets.toFixed(2)}</div>
                                  <div className="text-[10px] text-red-600 font-mono">sets</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ═══ NEAR-BUDGET CAUTION BANNER ═══ */}
                          {isNearBudget && (
                            <div className="mb-4 p-3 bg-[#2a2510] border-2 border-yellow-700 near-budget-banner">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                <div>
                                  <div className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-wide">
                                    Approaching Estimate — {pctOfEstimate.toFixed(0)}% Used
                                  </div>
                                  <div className="text-[10px] text-yellow-600 font-mono mt-0.5">
                                    {(estimatedStrokes - liveStrokes).toLocaleString()} strokes remaining before exceeding estimate
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ═══ ESTIMATE TARGET BAR ═══ */}
                          {estimatedStrokes > 0 && (
                            <div className="mb-4 p-3 bg-[#172032] border border-gray-700 estimate-target-bar">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" /> Estimate Target
                                </div>
                                <div className={`text-xs font-mono font-bold uppercase tracking-widest ${isOverBudget ? 'text-red-500' : isNearBudget ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                  {pctOfEstimate.toFixed(0)}% of estimate
                                </div>
                              </div>
                              {/* Estimated vs Actual visual bar */}
                              <div className="relative h-3 bg-gray-700 overflow-hidden">
                                <div
                                  className={`absolute inset-y-0 left-0 ${progressColor} transition-all duration-500 ease-out`}
                                  style={{ width: `${Math.min(pctOfEstimate, 100)}%` }}
                                />
                                {/* 100% marker line */}
                                {pctOfEstimate < 100 && (
                                  <div className="absolute inset-y-0 right-0 w-px bg-white/30" style={{ left: '100%' }} />
                                )}
                              </div>
                              <div className="flex justify-between mt-2 text-xs font-mono font-bold">
                                <span className="text-gray-500">
                                  Actual: <span className="text-white">{liveStrokes.toLocaleString()}</span>
                                </span>
                                <span className="text-gray-500">
                                  Estimate: <span className="text-white">{estimatedStrokes.toLocaleString()}</span> ({estimatedSets.toFixed(2)} sets)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* ═══ MAIN COUNTER CARD ═══ */}
                          <div className={`border-2 ${borderColor} ${bgTint}`}>
                            <div className="p-4">
                              <div className="flex justify-between items-center mb-3">
                                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isOverBudget ? 'text-red-500' : accentText}`}>
                                  {isOC ? 'Open Cell' : 'Closed Cell'} — Active
                                  {isOverBudget && <span className="ml-2 text-red-500">⚠ OVER</span>}
                                </div>
                                <button
                                  data-no-stroke
                                  onClick={() => resetStrokes(activeStrokeType)}
                                  className="text-gray-600 hover:text-white p-1 hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
                                  title={`Reset ${isOC ? 'OC' : 'CC'} counter`}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              </div>
                              
                              {/* Big Counter Display */}
                              <div className={`w-full p-6 ${counterBg} border-2 text-center select-none stroke-counter-box`}>
                                <div className={`text-7xl font-mono font-bold tabular-nums leading-none mb-2 stroke-counter-value ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                                  {liveStrokes.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-400 font-mono font-bold flex items-center justify-center gap-2">
                                  <Bluetooth className="w-4 h-4" /> STROKES
                                </div>
                                {/* Show estimated target directly under the count */}
                                {estimatedStrokes > 0 && (
                                  <div className={`mt-3 text-lg font-mono font-bold tabular-nums ${isOverBudget ? 'text-red-500' : isNearBudget ? 'text-yellow-500' : 'text-gray-500'}`}>
                                    of {estimatedStrokes.toLocaleString()} estimated
                                  </div>
                                )}
                              </div>

                              {/* Progress & Sets */}
                              <div className="mt-4 space-y-2 stroke-progress-section">
                                <div className="flex justify-between text-sm font-mono font-bold">
                                  <span className="text-gray-500">{liveStrokes.toLocaleString()} / {strokesPerSet.toLocaleString()} per set</span>
                                  <span className={`font-bold text-lg ${isOverBudget ? 'text-red-500' : accentText}`}>
                                    {liveSets.toFixed(2)} Sets
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-700 overflow-hidden">
                                  <div
                                    className={`h-full ${progressColor} transition-all duration-300`}
                                    style={{ width: `${Math.min((liveStrokes % strokesPerSet) / strokesPerSet * 100, 100)}%` }}
                                  />
                                </div>
                                {estimatedSets > 0 && (
                                  <div className="flex justify-between text-xs font-mono">
                                    <span className="text-gray-600">
                                      Estimated: {estimatedSets.toFixed(2)} sets
                                    </span>
                                    <span className={`font-bold ${isOverBudget ? 'text-red-500' : isNearBudget ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                      {isOverBudget 
                                        ? `+${(liveSets - estimatedSets).toFixed(2)} sets over`
                                        : `${(estimatedSets - liveSets).toFixed(2)} sets remaining`
                                      }
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ═══ Inactive Type Summary ═══ */}
                          <div className={`mt-3 p-3 border inactive-type-summary ${inactiveIsOver ? 'bg-[#2a1520] border-red-800' : 'bg-[#172032] border-gray-700'}`}>
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className={`font-bold uppercase tracking-widest ${inactiveIsOver ? 'text-red-500' : (isOC ? 'text-sky-500' : 'text-orange-500')}`}>
                                {isOC ? 'Closed Cell' : 'Open Cell'}
                                {inactiveIsOver && <span className="ml-1">⚠</span>}
                              </span>
                              <span className="text-white font-bold tabular-nums text-base">
                                {inactiveStrokes.toLocaleString()} strokes
                              </span>
                              <span className="text-gray-500 font-bold">
                                {(inactiveStrokes / inactiveStrokesPerSet).toFixed(2)} sets
                              </span>
                            </div>
                            {inactiveEstimated > 0 && (
                              <div className="flex justify-between mt-1.5 text-[10px] font-mono font-bold">
                                <span className="text-gray-600">
                                  Est: {inactiveEstimated.toLocaleString()} strokes
                                </span>
                                <span className={inactiveIsOver ? 'text-red-500' : 'text-gray-600'}>
                                  {inactiveIsOver 
                                    ? `⚠ ${(inactiveStrokes - inactiveEstimated).toLocaleString()} over`
                                    : `${(inactiveEstimated - inactiveStrokes).toLocaleString()} remaining`
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    <div className="mt-3 text-center text-[10px] text-gray-600 font-mono">
                      Input: {btConnected ? 'Bluetooth active' : 'Bluetooth (tap Activate above)'} &bull; Keyboard (Space/Enter) &bull; USB HID
                    </div>
                  </div>
                )}

                {/* ═══ RIGHT PANEL: Job Info (landscape tablet: right column) ═══ */}
                <div className={`crew-info-panel space-y-3 ${!isTimerRunning ? 'crew-info-full' : ''}`}>

                {/* Completed Banner */}
                {selectedJob.executionStatus === 'Completed' && (
                    <div className="bg-[#152a20] border-2 border-emerald-800 p-3 flex items-center gap-3 text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <div>
                            <div className="font-mono font-bold uppercase text-xs tracking-widest">Job Completed</div>
                            <div className="text-sm font-mono text-emerald-600">Submitted by {selectedJob.actuals?.completedBy} on {new Date(selectedJob.actuals?.completionDate || "").toLocaleDateString()}</div>
                        </div>
                    </div>
                )}

                {/* Stroke Summary when paused but has data */}
                {!isTimerRunning && (liveOCStrokes > 0 || liveCCStrokes > 0) && selectedJob.executionStatus !== 'Completed' && (
                  <div className="bg-gray-800 p-4 border-2 border-gray-600">
                    <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-500" /> Stroke Count (Paused)
                    </h3>
                    {(() => {
                      const estOC = selectedJob.materials?.openCellStrokes || selectedJob.results?.openCellStrokes || 0;
                      const estCC = selectedJob.materials?.closedCellStrokes || selectedJob.results?.closedCellStrokes || 0;
                      const ocOver = estOC > 0 && liveOCStrokes > estOC;
                      const ccOver = estCC > 0 && liveCCStrokes > estCC;
                      return (
                        <>
                          {(ocOver || ccOver) && (
                            <div className="mb-4 p-3 bg-[#2a1015] border-2 border-red-800 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                              <span className="text-xs font-mono font-bold text-red-500">
                                {ocOver && ccOver ? 'Both OC & CC' : ocOver ? 'Open Cell' : 'Closed Cell'} over estimated chemical usage
                              </span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`p-3 border-2 ${ocOver ? 'bg-[#2a1520] border-red-800' : 'bg-[#2a2010] border-orange-800'}`}>
                              <div className="text-[10px] text-orange-500 font-mono font-bold uppercase tracking-widest mb-1">Open Cell</div>
                              <div className={`text-2xl font-mono font-bold ${ocOver ? 'text-red-400' : 'text-white'}`}>{liveOCStrokes.toLocaleString()}</div>
                              <div className="text-xs text-gray-500 font-mono">{(liveOCStrokes / ocStrokesPerSet).toFixed(2)} sets</div>
                              {estOC > 0 && (
                                <div className={`text-[10px] font-mono font-bold mt-1 ${ocOver ? 'text-red-500' : 'text-gray-600'}`}>
                                  {ocOver ? `⚠ ${(liveOCStrokes - estOC).toLocaleString()} over est.` : `Est: ${estOC.toLocaleString()}`}
                                </div>
                              )}
                            </div>
                            <div className={`p-3 border-2 ${ccOver ? 'bg-[#2a1520] border-red-800' : 'bg-[#102a2a] border-sky-800'}`}>
                              <div className="text-[10px] text-sky-500 font-mono font-bold uppercase tracking-widest mb-1">Closed Cell</div>
                              <div className={`text-2xl font-mono font-bold ${ccOver ? 'text-red-400' : 'text-white'}`}>{liveCCStrokes.toLocaleString()}</div>
                              <div className="text-xs text-gray-500 font-mono">{(liveCCStrokes / ccStrokesPerSet).toFixed(2)} sets</div>
                              {estCC > 0 && (
                                <div className={`text-[10px] font-mono font-bold mt-1 ${ccOver ? 'text-red-500' : 'text-gray-600'}`}>
                                  {ccOver ? `⚠ ${(liveCCStrokes - estCC).toLocaleString()} over est.` : `Est: ${estCC.toLocaleString()}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-2" data-no-stroke>
                    <a 
                        data-no-stroke
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.customer.address + ' ' + selectedJob.customer.zip)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-gray-800 border-2 border-gray-600 text-white p-3 flex flex-col items-center justify-center gap-2 hover:border-orange-600 hover:bg-gray-700 transition-colors"
                    >
                        <MapPin className="w-5 h-5 text-orange-500" /> 
                        <span className="font-mono font-bold text-xs uppercase tracking-widest">GPS Map</span>
                    </a>
                    {selectedJob.workOrderSheetUrl ? (
                         <a 
                            data-no-stroke
                            href={selectedJob.workOrderSheetUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-gray-800 border-2 border-gray-600 text-white p-3 flex flex-col items-center justify-center gap-2 hover:border-emerald-600 hover:bg-gray-700 transition-colors"
                        >
                             <FileText className="w-5 h-5 text-emerald-500" /> 
                             <span className="font-mono font-bold text-xs uppercase tracking-widest">View Sheet</span>
                         </a>
                    ) : (
                         <div className="bg-[#172032] text-gray-600 p-3 flex flex-col items-center justify-center gap-2 border-2 border-gray-700">
                             <FileText className="w-5 h-5" /> 
                             <span className="font-mono font-bold text-xs uppercase tracking-widest">No Sheet</span>
                         </div>
                    )}
                </div>

                {/* Customer Info Card */}
                <div className="bg-gray-800 p-4 border-2 border-gray-600 info-card">
                    <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" /> Client & Location
                    </h3>
                    <div>
                        <div className="text-xl font-mono font-bold text-white mb-1">{selectedJob.customer.name}</div>
                        <div className="text-gray-400 font-mono text-sm leading-snug">
                            {selectedJob.customer.address}<br/>
                            {selectedJob.customer.city}, {selectedJob.customer.state} {selectedJob.customer.zip}
                        </div>
                    </div>
                </div>

                {/* Scope Card */}
                <div className="bg-gray-800 p-4 border-2 border-gray-600 info-card">
                    <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"> 
                        <HardHat className="w-4 h-4"/> Install Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(selectedJob.results?.totalWallArea ?? 0) > 0 && (
                            <div className="p-3 bg-[#172032] border border-gray-700">
                                <div className="text-[10px] text-orange-500 font-mono font-bold uppercase tracking-widest mb-1">Walls</div>
                                <div className="text-white font-mono font-bold text-base leading-tight">{selectedJob.wallSettings?.type}</div>
                                <div className="text-gray-400 font-mono text-sm mt-1">@ {selectedJob.wallSettings?.thickness}" Depth</div>
                                <div className="mt-2 pt-2 border-t border-gray-700 text-xs font-mono font-bold text-gray-500 text-right">{Math.round(selectedJob.results?.totalWallArea ?? 0).toLocaleString()} sqft</div>
                            </div>
                        )}
                        {(selectedJob.results?.totalRoofArea ?? 0) > 0 && (
                            <div className="p-3 bg-[#172032] border border-gray-700">
                                <div className="text-[10px] text-orange-500 font-mono font-bold uppercase tracking-widest mb-1">Roof / Ceiling</div>
                                <div className="text-white font-mono font-bold text-base leading-tight">{selectedJob.roofSettings?.type}</div>
                                <div className="text-gray-400 font-mono text-sm mt-1">@ {selectedJob.roofSettings?.thickness}" Depth</div>
                                <div className="mt-2 pt-2 border-t border-gray-700 text-xs font-mono font-bold text-gray-500 text-right">{Math.round(selectedJob.results?.totalRoofArea ?? 0).toLocaleString()} sqft</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Load List Card */}
                <div className="bg-gray-800 p-4 border-2 border-gray-600 info-card">
                    <h3 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Truck Load List
                    </h3>
                    <div className="space-y-1">
                         {selectedJob.materials?.openCellSets > 0 && (
                             <div className="flex justify-between items-center p-3 bg-[#172032] border border-gray-700">
                                 <div>
                                     <span className="font-mono font-bold text-white block text-sm">Open Cell Foam</span>
                                     <span className="text-[10px] text-gray-600 font-mono font-bold uppercase tracking-wider">
                                         Est. {selectedJob.results?.openCellStrokes?.toLocaleString()} Strokes
                                     </span>
                                 </div>
                                 <span className="bg-gray-700 px-3 py-1 border border-orange-700 text-orange-500 font-mono font-bold text-sm">{selectedJob.materials.openCellSets.toFixed(2)} Sets</span>
                             </div>
                         )}
                         {selectedJob.materials?.closedCellSets > 0 && (
                             <div className="flex justify-between items-center p-3 bg-[#172032] border border-gray-700">
                                 <div>
                                     <span className="font-mono font-bold text-white block text-sm">Closed Cell Foam</span>
                                     <span className="text-[10px] text-gray-600 font-mono font-bold uppercase tracking-wider">
                                         Est. {selectedJob.results?.closedCellStrokes?.toLocaleString()} Strokes
                                     </span>
                                 </div>
                                 <span className="bg-gray-700 px-3 py-1 border border-orange-700 text-orange-500 font-mono font-bold text-sm">{selectedJob.materials.closedCellSets.toFixed(2)} Sets</span>
                             </div>
                         )}
                         {selectedJob.materials?.inventory?.map((item) => (
                             <div key={item.id} className="flex justify-between items-center p-3 bg-[#172032] border border-gray-700">
                                 <span className="font-mono font-bold text-white text-sm">{item.name}</span>
                                 <span className="text-gray-400 font-mono font-bold text-sm">{item.quantity} {item.unit}</span>
                             </div>
                         ))}
                    </div>
                </div>

                {/* Notes Card */}
                {selectedJob.notes && (
                    <div className="bg-[#2a2510] p-4 border-2 border-yellow-800 info-card">
                        <h3 className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Job Notes
                        </h3>
                        <p className="text-yellow-300 text-sm font-mono leading-relaxed">
                            {selectedJob.notes}
                        </p>
                    </div>
                )}

                </div>{/* end crew-info-panel */}
            </div>

            {/* Completion Modal */}
            {showCompletionModal && (
                <div data-completion-modal className="fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 border-2 border-gray-600 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-mono font-bold text-white uppercase tracking-tight mb-6 border-b border-gray-600 pb-3">Complete Job</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-2">Total Labor Hours</label>
                                <input 
                                    type="number" 
                                    value={actuals.laborHours || ''} 
                                    onChange={(e) => setActuals({...actuals, laborHours: parseFloat(e.target.value) || 0})}
                                    className="w-full p-3 bg-gray-900 border-2 border-gray-600 font-mono font-bold text-2xl text-center text-white focus:border-orange-600 outline-none"
                                />
                            </div>

                            <div className="p-3 bg-[#172032] border border-gray-700 space-y-3">
                                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-widest border-b border-gray-700 pb-2">Material Usage (Sets)</h4>
                                <div>
                                    <label className="text-xs font-mono font-bold text-gray-500 flex justify-between mb-1"><span>Open Cell</span> <span>Est: {selectedJob.materials?.openCellSets.toFixed(2)}</span></label>
                                    <input 
                                        type="number" step="0.25"
                                        value={actuals.openCellSets} 
                                        onChange={(e) => {
                                            const sets = parseFloat(e.target.value) || 0;
                                            const derivedStrokes = Math.round(sets * ocStrokesPerSet);
                                            setActuals({...actuals, openCellSets: sets, openCellStrokes: derivedStrokes});
                                        }}
                                        placeholder="0.00"
                                        className="w-full p-3 bg-gray-900 border-2 border-gray-600 font-mono font-bold text-lg text-white focus:border-orange-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-mono font-bold text-gray-500 flex justify-between mb-1"><span>Closed Cell</span> <span>Est: {selectedJob.materials?.closedCellSets.toFixed(2)}</span></label>
                                    <input 
                                        type="number" step="0.25"
                                        value={actuals.closedCellSets} 
                                        onChange={(e) => {
                                            const sets = parseFloat(e.target.value) || 0;
                                            const derivedStrokes = Math.round(sets * ccStrokesPerSet);
                                            setActuals({...actuals, closedCellSets: sets, closedCellStrokes: derivedStrokes});
                                        }}
                                        placeholder="0.00"
                                        className="w-full p-3 bg-gray-900 border-2 border-gray-600 font-mono font-bold text-lg text-white focus:border-orange-600 outline-none"
                                    />
                                </div>
                            </div>

                            {/* STROKE COUNTS */}
                            <div className="p-3 bg-[#102530] border border-sky-900 space-y-3">
                                <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest border-b border-sky-900 pb-2">Machine Counters (Strokes)</h4>
                                <div>
                                    <label className="text-xs font-mono font-bold text-sky-600 flex justify-between mb-1"><span>Open Cell Strokes</span> <span>Est: {selectedJob.results?.openCellStrokes?.toLocaleString()}</span></label>
                                    <input 
                                        type="number"
                                        value={actuals.openCellStrokes || ''} 
                                        onChange={(e) => {
                                            const strokes = parseInt(e.target.value) || 0;
                                            const derivedSets = strokes > 0 ? parseFloat((strokes / ocStrokesPerSet).toFixed(2)) : actuals.openCellSets;
                                            setActuals({...actuals, openCellStrokes: strokes, openCellSets: derivedSets});
                                        }}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-900 border-2 border-sky-900 font-mono font-bold text-lg text-sky-300 focus:border-sky-500 outline-none"
                                    />
                                    {actuals.openCellStrokes > 0 && <p className="text-[10px] text-sky-600 font-mono mt-1 text-right">= {(actuals.openCellStrokes / ocStrokesPerSet).toFixed(2)} Sets ({ocStrokesPerSet} strokes/set)</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-mono font-bold text-sky-600 flex justify-between mb-1"><span>Closed Cell Strokes</span> <span>Est: {selectedJob.results?.closedCellStrokes?.toLocaleString()}</span></label>
                                    <input 
                                        type="number"
                                        value={actuals.closedCellStrokes || ''} 
                                        onChange={(e) => {
                                            const strokes = parseInt(e.target.value) || 0;
                                            const derivedSets = strokes > 0 ? parseFloat((strokes / ccStrokesPerSet).toFixed(2)) : actuals.closedCellSets;
                                            setActuals({...actuals, closedCellStrokes: strokes, closedCellSets: derivedSets});
                                        }}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-900 border-2 border-sky-900 font-mono font-bold text-lg text-sky-300 focus:border-sky-500 outline-none"
                                    />
                                    {actuals.closedCellStrokes > 0 && <p className="text-[10px] text-sky-600 font-mono mt-1 text-right">= {(actuals.closedCellStrokes / ccStrokesPerSet).toFixed(2)} Sets ({ccStrokesPerSet} strokes/set)</p>}
                                </div>
                            </div>

                            {/* INVENTORY ITEMS (Non-Foam Materials) */}
                            {actuals.inventory && actuals.inventory.length > 0 && (
                                <div className="p-3 bg-[#252515] border border-yellow-900 space-y-3">
                                    <h4 className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-widest border-b border-yellow-900 pb-2 flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5" /> Inventory Used (Actual)
                                    </h4>
                                    {actuals.inventory.map((item: any, idx: number) => (
                                        <div key={item.id || idx}>
                                            <label className="text-xs font-mono font-bold text-yellow-600 flex justify-between mb-1">
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
                                                className="w-full p-3 bg-gray-900 border-2 border-yellow-900 font-mono font-bold text-lg text-yellow-300 focus:border-yellow-600 outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* CREW NOTES */}
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3"/> Crew Notes / Issues
                                </label>
                                <textarea
                                    className="w-full p-3 bg-gray-900 border-2 border-gray-600 font-mono text-sm text-white focus:border-orange-600 outline-none resize-none h-24"
                                    placeholder="Mention any issues, extra materials used, or specific details for the office..."
                                    value={actuals.notes}
                                    onChange={(e) => setActuals({...actuals, notes: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-700">
                                <button onClick={() => setShowCompletionModal(false)} disabled={isCompleting} className="flex-1 p-3 border-2 border-gray-600 font-mono font-bold uppercase text-xs tracking-widest text-gray-500 hover:bg-gray-700 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleCompleteJobSubmit} disabled={isCompleting} className="flex-1 p-3 bg-orange-600 text-white border-2 border-orange-500 font-mono font-bold uppercase text-xs tracking-widest hover:bg-orange-500 flex items-center justify-center gap-2 transition-colors">
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
    <div className="min-h-screen bg-gray-900 font-mono text-white pb-20 crew-list-root">
        
        {/* Floating Install Icon for Crew */}
        {installPrompt && (
          <div className="fixed bottom-6 right-6 z-[100]">
             <button 
                onClick={onInstall}
                className="flex items-center gap-3 bg-gray-800 text-white pl-4 pr-6 py-3 border-2 border-gray-600 hover:border-orange-600 transition-colors"
                title="Install Desktop App"
             >
                <Download className="w-5 h-5 text-orange-500" />
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-gray-500 leading-none mb-0.5">Desktop App</span>
                    <span className="font-mono font-bold text-sm leading-none">Install Now</span>
                </div>
             </button>
          </div>
        )}

        {/* Header */}
        <header className="bg-gray-800 text-white px-4 py-3 border-b-2 border-gray-600">
            <div className="flex justify-between items-center mb-3">
                <RFESmallLogo />
                <div className="flex gap-2 items-center">
                    <div className="text-right">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Status</div>
                        <div className="text-xs font-mono font-bold text-emerald-500 flex items-center justify-end gap-1">
                            {syncStatus === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin"/> : <div className="w-2 h-2 bg-emerald-500"></div>}
                            {syncStatus === 'syncing' ? 'Syncing...' : 'Live'}
                        </div>
                    </div>
                    {installPrompt && (
                        <button onClick={onInstall} className="p-2 bg-emerald-900 border border-emerald-700 text-emerald-400 hover:bg-emerald-800 transition-colors" title="Install App">
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onLogout} className="p-2 bg-gray-700 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-lg font-mono font-bold uppercase tracking-widest">Crew Dashboard</h1>
                    <p className="text-gray-500 text-xs font-mono">Select a Work Order to begin.</p>
                    <div className="mt-2"><FeedbackButton area="Crew Dashboard" /></div>
                </div>
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`text-xs font-mono font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors flex items-center gap-2 ${showHistory ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-600 hover:border-gray-500 hover:text-gray-300'}`}
                >
                    <History className="w-4 h-4" /> {showHistory ? 'Hide History' : 'History'}
                </button>
            </div>
        </header>

        <div className="px-4 mt-4 space-y-2 max-w-2xl mx-auto crew-list-content">
            {displayedJobs.length === 0 ? (
                <div className="bg-gray-800 border-2 border-gray-600 p-8 text-center">
                    <div className="w-12 h-12 bg-gray-700 border border-gray-600 flex items-center justify-center mx-auto mb-4 text-gray-500">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-mono font-bold text-white mb-2 uppercase tracking-widest">{showHistory ? 'No Completed Jobs' : 'All Caught Up'}</h3>
                    <p className="text-gray-500 text-xs font-mono">{showHistory ? 'Completed work orders will appear here.' : 'No pending work orders assigned.'}</p>
                    {!showHistory && (
                        <button onClick={() => onSync()} className="mt-4 text-orange-500 font-mono font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:text-orange-400 mx-auto">
                            <RefreshCw className="w-4 h-4" /> Refresh List
                        </button>
                    )}
                </div>
            ) : (
                displayedJobs.map(job => (
                    <button 
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full bg-gray-800 p-4 border-2 border-gray-600 text-left hover:border-orange-600 transition-colors group relative ${job.executionStatus === 'Completed' ? 'opacity-70 hover:opacity-100' : ''}`}
                    >
                        <div className={`absolute top-0 left-0 w-1 h-full ${job.executionStatus === 'Completed' ? 'bg-emerald-600' : 'bg-gray-700 group-hover:bg-orange-600'} transition-colors`}></div>
                        <div className="flex justify-between items-start mb-3 pl-3">
                            <div>
                                <div className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    Work Order {job.executionStatus === 'Completed' && <span className="bg-emerald-900 text-emerald-400 px-1.5 py-0.5 border border-emerald-700">DONE</span>}
                                </div>
                                <div className="text-base font-mono font-bold text-orange-500">#{job.id.substring(0,8).toUpperCase()}</div>
                            </div>
                            <div className="p-1.5 border border-gray-600 text-gray-500 group-hover:text-orange-500 group-hover:border-orange-600 transition-colors">
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="pl-3 space-y-1">
                             <div className="flex items-center gap-2 text-sm font-mono font-bold text-white">
                                <User className="w-4 h-4 text-gray-500" /> {job.customer.name}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-mono text-gray-400">
                                <MapPin className="w-4 h-4 text-gray-600" /> {job.customer.city}, {job.customer.state}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-mono text-gray-400">
                                <Calendar className="w-4 h-4 text-gray-600" /> {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : "Unscheduled"}
                             </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    </div>
  );
};
