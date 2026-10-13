'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { useTheme } from '@/lib/theme/ThemeContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { playSuccessBeep, playErrorBuzzer } from '@/lib/audio/sound-effects';
import { ScanResultType, Ticket } from '@/types';
import { formatRelativeTime } from '@/lib/utils/format';
import { TicketCodeSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/security/rate-limit';
import jsQR from 'jsqr';
import Link from 'next/link';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  DoorOpen,
  CheckCircle2,
  XCircle,
  QrCode,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Volume2,
  VolumeX,
  Flashlight,
  FlashlightOff,
  History,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

const GATES = [
  'Porte A - Entrée Principale',
  'Porte B - Gradins Sud',
  'Porte C - VIP Prestige',
  'Porte D - Tribune Presse',
];

/**
 * Extracts a ticket code from raw scanned text or URL
 * Examples:
 * - "JT-7777-DEMO" -> "JT-7777-DEMO"
 * - "https://jeltix.sn/tickets/JT-7777-DEMO" -> "JT-7777-DEMO"
 * - "https://foutaticket.sn/tickets/JT-2026-VIP" -> "JT-2026-VIP"
 */
function extractTicketCode(raw: string): string {
  const clean = raw.trim();
  const urlMatch = clean.match(/\/tickets\/([A-Za-z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toUpperCase();
  }
  const jeltixMatch = clean.match(/JELTIX:([^:]+):/i);
  if (jeltixMatch && jeltixMatch[1]) {
    return jeltixMatch[1].toUpperCase();
  }
  const codeMatch = clean.match(/(?:JT|FT)-[A-Z0-9-]+/i);
  if (codeMatch) {
    return codeMatch[0].toUpperCase();
  }
  return clean.toUpperCase();
}

export default function PwaScannerPage() {
  const { validateScanAtomic, scans, currentUser } = useJeltixStore();
  const { theme } = useTheme();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isController = currentUser?.role === 'CONTROLLER';
  const isAuthorized = isSuperAdmin || isController;

  const [selectedGate, setSelectedGate] = useState('Porte A - Entrée Principale');
  const [controllerName] = useState(currentUser?.fullName || 'Agent Contrôle #12');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Accès restreint : Seuls Super Admin et Contrôleur peuvent scanner
  if (currentUser && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black mb-2">Accès Restreint au Scanner</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          Le module de contrôle d'accès et scan de billets est réservé aux Agents de Contrôle et Super Administrateurs.
        </p>
        <Link
          href={currentUser.role === 'SELLER' ? '/sales/pos' : '/dashboard'}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-2"
        >
          <span>Retourner à mon espace</span>
        </Link>
      </div>
    );
  }

  // Camera & Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Scan Result Overlay State
  const [scanResult, setScanResult] = useState<{
    status: ScanResultType;
    message: string;
    ticket?: Ticket;
    previousScanDate?: string;
    previousScanGate?: string;
  } | null>(null);

  // Refs for camera loop and scanning control
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const scanResultRef = useRef(scanResult);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Keep ref synchronized with state
  useEffect(() => {
    scanResultRef.current = scanResult;
    isPausedRef.current = Boolean(scanResult);
  }, [scanResult]);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchActive(false);
    setTorchSupported(false);
  }, []);

  // Frame scanning engine using requestAnimationFrame
  const startScanningLoop = useCallback(() => {
    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !isPausedRef.current &&
        !scanResultRef.current
      ) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          // Scale to max 640px for fast mobile CPU processing
          const scale = Math.min(1, 640 / Math.max(vw, vh));
          const targetWidth = Math.floor(vw * scale);
          const targetHeight = Math.floor(vh * scale);

          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (decoded && decoded.data && decoded.data.trim().length > 0) {
            const rawCode = decoded.data.trim();
            const now = Date.now();

            // Prevent repeated immediate scan of identical QR code within 2.5 seconds
            if (
              rawCode !== lastScannedCodeRef.current ||
              now - lastScannedTimeRef.current > 2500
            ) {
              lastScannedCodeRef.current = rawCode;
              lastScannedTimeRef.current = now;
              handleProcessCode(rawCode);
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, []);

  // Initialize and start device camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Votre navigateur ne supporte pas l'accès direct à la caméra.");
      setCameraLoading(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flashlight is supported on this track
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          setTorchSupported(Boolean(capabilities?.torch));
        } catch {
          setTorchSupported(false);
        }
      }

      // Detect if user has multiple camera inputs (rear/front)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {}

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setCameraLoading(false);
      setCameraActive(true);
      startScanningLoop();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraLoading(false);
      setCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          "Accès à la caméra refusé. Veuillez autoriser l'appareil photo dans les paramètres de votre navigateur."
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Aucune caméra détectée sur votre téléphone ou appareil.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('La caméra est déjà utilisée par une autre application.');
      } else {
        setCameraError("Impossible d'activer la caméra. Vérifiez vos autorisations.");
      }
    }
  }, [facingMode, stopCamera, startScanningLoop]);

  // Start camera on mount & restart when facingMode changes
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Toggle physical Torch / LED flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextState = !torchActive;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchActive(nextState);
    } catch (e) {
      console.warn('Torch toggle not supported via constraints:', e);
      setTorchActive(nextState);
    }
  };

  // Flip camera between front (user) and back (environment)
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Process a scanned or typed ticket code
  const handleProcessCode = async (rawInput: string) => {
    if (!rawInput.trim()) return;

    // Rate Limiting Protection (Max 40 scans per minute per controller)
    const rateCheck = checkRateLimit('controller_scan_gate', 40, 60000);
    if (!rateCheck.success) {
      if (soundEnabled) playErrorBuzzer();
      setScanResult({
        status: 'INVALID',
        message: 'Cadence de scan trop élevée. Veuillez patienter un instant.',
      });
      return;
    }

    const cleanCode = extractTicketCode(rawInput);
    let result: any = null;

    // 1. Validation en temps réel sur Supabase Cloud (Source de vérité partagée multi-contrôleurs)
    try {
      const res = await fetch('/api/local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VALIDATE_SCAN',
          ticketCode: cleanCode,
          gate: selectedGate,
          controllerName,
          controllerId: currentUser?.id,
        }),
      });
      if (res.ok) {
        const cloudRes = await res.json();
        if (cloudRes && cloudRes.result) {
          result = cloudRes;
        }
      }
    } catch (cloudErr) {
      console.warn('Mode hors-ligne: validation sur le registre local:', cloudErr);
    }

    // 2. Si le cloud est inaccessible (hors-ligne), validation instantanée sur le registre local
    if (!result) {
      result = validateScanAtomic(cleanCode, selectedGate, controllerName);
    }

    // Haptic feedback (vibration on mobile)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(result.success ? [80, 50, 80] : [250]);
      } catch {}
    }

    if (result.success) {
      if (soundEnabled) playSuccessBeep();
      setScanResult({
        status: 'VALID',
        message: result.message,
        ticket: result.ticket,
      });
    } else if (result.result === 'ALREADY_SCANNED') {
      if (soundEnabled) playErrorBuzzer();
      setScanResult({
        status: 'ALREADY_SCANNED',
        message: result.message,
        ticket: result.ticket,
        previousScanDate: result.previousScanDate,
        previousScanGate: result.previousScanGate,
      });
    } else {
      if (soundEnabled) playErrorBuzzer();
      setScanResult({
        status: 'INVALID',
        message: result.message,
      });
    }

    setManualCode('');
    setManualError(null);
  };

  // Manual code submit handler with Zod validation
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualCode.trim()) return;

    const validation = TicketCodeSchema.safeParse(manualCode);
    if (!validation.success) {
      setManualError(validation.error.issues[0]?.message || 'Code billet invalide');
      return;
    }
    setManualError(null);
    handleProcessCode(manualCode);
  };

  // Clear current result and resume optical scanning
  const clearResult = () => {
    setScanResult(null);
    isPausedRef.current = false;
  };

  // Gate statistics
  const gateScans = scans.filter((s) => s.gate === selectedGate);
  const gateValidCount = gateScans.filter((s) => s.result === 'VALID').length;
  const gateFraudCount = gateScans.filter((s) => s.result !== 'VALID').length;


  const isDark = theme === 'dark';

  return (
    <div
      className={`w-full min-h-[100dvh] flex flex-col justify-between select-none overflow-x-hidden font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#050D1E] text-white' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Hidden processing canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 1. Header: Edge-to-Edge Brand & Quick Controls */}
      <header
        className={`w-full px-4 sm:px-6 py-3 border-b flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors ${
          isDark
            ? 'bg-[#0B1936] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl shadow-xs shrink-0 flex items-center justify-center border border-slate-200/50">
            <img src="/logo.png" alt="Jël Tix" className="h-8 w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-mono uppercase font-black tracking-wider ${
                  isDark ? 'text-[#4EED15]' : 'text-[#0038A8]'
                }`}
              >
                SCANNER CONTRÔLEUR MOBILE
              </span>
            </div>
            <p
              className={`text-[11px] font-mono flex items-center gap-1 leading-none mt-0.5 ${
                isDark ? 'text-white/70' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cameraActive ? 'bg-[#4EED15] animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>
                {controllerName} • {cameraActive ? 'Caméra Active' : 'En veille'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Mute Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 opacity-60'
            }`}
            title={soundEnabled ? 'Son activé' : 'Son coupé'}
            aria-label="Contrôle du son"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Torch / Flashlight Toggle */}
          <button
            onClick={toggleTorch}
            disabled={!cameraActive}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              torchActive
                ? 'bg-[#4EED15] text-[#002D8C] border-[#4EED15] shadow-md ring-2 ring-[#4EED15]/40'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 disabled:opacity-40'
            }`}
            title={torchActive ? 'Éteindre la torche' : 'Allumer la torche LED'}
            aria-label="Torche LED"
          >
            {torchActive ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
          </button>

          {/* Flip Camera (Front / Rear) */}
          <button
            onClick={toggleCameraFacing}
            disabled={cameraLoading}
            className="p-2 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-40"
            title={`Basculer caméra (${facingMode === 'environment' ? 'Arrière' : 'Avant'})`}
            aria-label="Basculer caméra"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-[#0038A8] text-white hover:bg-[#002D8C] transition-colors shadow-xs"
            title="Quitter vers le Dashboard"
            aria-label="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* 2. Top Bar: Gate Selector & Live Gate KPIs */}
      <div className="max-w-md mx-auto w-full px-4 pt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
              Porte / Tourniquet Actif
            </label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="w-full bg-white dark:bg-[#0B1936] text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 dark:border-white/15 outline-none text-slate-800 dark:text-white cursor-pointer shadow-xs"
            >
              {GATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="mt-4 px-3 py-2 rounded-xl bg-white dark:bg-[#0B1936] text-xs font-bold border border-slate-200 dark:border-white/15 flex items-center gap-1.5 shadow-xs cursor-pointer text-slate-700 dark:text-slate-200"
          >
            <History className="w-3.5 h-3.5 text-primary" />
            <span>Historique ({gateScans.length})</span>
          </button>
        </div>

        {/* Live Gate Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white dark:bg-[#0B1936] p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xs">
            <p className="text-[9px] uppercase font-mono text-slate-400">Total Scans</p>
            <p className="text-base font-black text-slate-800 dark:text-white mt-0.5">
              {gateScans.length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0B1936] p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xs">
            <p className="text-[9px] uppercase font-mono text-[#2CA808] dark:text-[#4EED15]">
              Entrées Valides
            </p>
            <p className="text-base font-black text-[#2CA808] dark:text-[#4EED15] mt-0.5">
              {gateValidCount}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0B1936] p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xs">
            <p className="text-[9px] uppercase font-mono text-[#DC2626]">Doublons / Rejets</p>
            <p className="text-base font-black text-[#DC2626] mt-0.5">{gateFraudCount}</p>
          </div>
        </div>
      </div>

      {/* 3. Main Center: Camera Viewfinder with Real Video Stream */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full relative">
        <div
          className={`relative w-full aspect-square max-w-[340px] rounded-3xl overflow-hidden border-2 shadow-2xl flex flex-col items-center justify-center transition-all bg-black ${
            torchActive ? 'ring-8 ring-[#4EED15]/40' : ''
          } ${
            isDark
              ? 'border-[#0038A8]/60 shadow-[#0038A8]/20'
              : 'border-slate-800 shadow-slate-900/30'
          }`}
        >
          {/* Live Mobile Camera Video Stream */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive && !cameraLoading ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Active Laser Scanning Beam */}
          {cameraActive && !scanResult && (
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#4EED15] to-transparent shadow-[0_0_15px_#4EED15] animate-scan-laser z-10 pointer-events-none" />
          )}

          {/* Viewfinder 4 Corner Brackets */}
          <div className="absolute top-4 left-4 w-7 h-7 border-t-4 border-l-4 border-[#4EED15] rounded-tl-lg z-10 pointer-events-none" />
          <div className="absolute top-4 right-4 w-7 h-7 border-t-4 border-r-4 border-[#4EED15] rounded-tr-lg z-10 pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-7 h-7 border-b-4 border-l-4 border-[#4EED15] rounded-bl-lg z-10 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-7 h-7 border-b-4 border-r-4 border-[#4EED15] rounded-br-lg z-10 pointer-events-none" />

          {/* Viewfinder Overlay Guide (Active State) */}
          {cameraActive && !cameraLoading && !scanResult && (
            <div className="absolute bottom-6 left-0 right-0 text-center z-10 pointer-events-none px-4">
              <span className="bg-black/60 backdrop-blur-md text-[#4EED15] text-[11px] font-mono font-bold px-3 py-1 rounded-full shadow-md">
                Visez le QR Code du billet
              </span>
            </div>
          )}

          {/* Camera Loading State */}
          {cameraLoading && (
            <div className="flex flex-col items-center text-center text-white/80 space-y-3 p-6 z-10">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md animate-spin">
                <RefreshCw className="w-8 h-8 text-[#4EED15]" />
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-white">
                Initialisation de la caméra...
              </p>
              <p className="text-[11px] text-white/60 font-mono">Activation de l'objectif</p>
            </div>
          )}

          {/* Camera Error or Permission Denied State */}
          {cameraError && !cameraLoading && (
            <div className="flex flex-col items-center text-center text-white space-y-3 p-6 z-10 bg-slate-900/95 absolute inset-0 justify-center">
              <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                <CameraOff className="w-7 h-7" />
              </div>
              <p className="text-xs font-black text-white uppercase tracking-wider">
                Caméra Inaccessible
              </p>
              <p className="text-[11px] text-white/70 max-w-xs">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-2 px-4 py-2 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Autoriser & Réessayer</span>
              </button>
            </div>
          )}

          {/* Full-Screen Instant Scan Result Overlay */}
          {scanResult && (
            <div
              className={`absolute inset-0 z-30 p-5 flex flex-col justify-between animate-in zoom-in-95 duration-150 text-white ${
                scanResult.status === 'VALID'
                  ? 'bg-gradient-to-b from-[#15803D] via-[#16A34A] to-[#14532D]'
                  : scanResult.status === 'ALREADY_SCANNED'
                  ? 'bg-gradient-to-b from-[#C2410C] via-[#EA580C] to-[#7C2D12]'
                  : 'bg-gradient-to-b from-[#DC2626] via-[#B91C1C] to-[#7F1D1D]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <span className="text-[10px] font-mono uppercase font-black tracking-wider">
                  {scanResult.status === 'VALID'
                    ? 'CONTRÔLE RÉUSSI • ENTRÉE AUTORISÉE'
                    : scanResult.status === 'ALREADY_SCANNED'
                    ? 'ALERTE FRAUDE • DÉJÀ SCANNÉ'
                    : 'CONTRÔLE ÉCHOUÉ • BILLET INVALIDE'}
                </span>
                <button
                  onClick={clearResult}
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer"
                >
                  Scanner suivant ➔
                </button>
              </div>

              <div className="flex flex-col items-center text-center space-y-2 my-auto">
                {scanResult.status === 'VALID' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white text-[#15803D] flex items-center justify-center shadow-xl ring-4 ring-white/30">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">ACCÈS AUTORISÉ</p>
                    <p className="text-xs font-bold text-white/90 font-mono">
                      Billet #{scanResult.ticket?.ticketCode}
                    </p>
                    <div className="bg-white/15 backdrop-blur-sm p-3.5 rounded-2xl w-full text-left text-xs space-y-1.5 mt-2 border border-white/20">
                      <p className="font-extrabold text-white text-sm">{scanResult.ticket?.customerName}</p>
                      <p className="text-white/90 font-semibold">{scanResult.ticket?.ticketTypeName}</p>
                      <p className="text-[11px] text-emerald-200 font-mono font-bold">
                        {scanResult.ticket?.gateRecommendation} • {scanResult.ticket?.seatNumber}
                      </p>
                      <p className="text-[10px] text-white/70 truncate">{scanResult.ticket?.eventTitle}</p>
                    </div>
                  </>
                ) : scanResult.status === 'ALREADY_SCANNED' ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white text-[#C2410C] flex items-center justify-center shadow-xl ring-4 ring-white/30">
                      <AlertTriangle className="w-10 h-10" />
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">BILLET DÉJÀ SCANNÉ</p>
                    <p className="text-xs font-bold text-white/95">
                      Billet #{scanResult.ticket?.ticketCode}
                    </p>
                    <div className="bg-black/25 backdrop-blur-sm p-3.5 rounded-2xl w-full text-left text-xs space-y-1 mt-2 border border-white/20">
                      <p className="font-bold text-white">Tentative de double passage détectée</p>
                      {scanResult.previousScanDate && (
                        <p className="text-[11px] text-amber-200 font-mono">
                          1er scan : {new Date(scanResult.previousScanDate).toLocaleTimeString()} ({scanResult.previousScanGate})
                        </p>
                      )}
                      <p className="text-[10px] text-white/80">Participant : {scanResult.ticket?.customerName}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white text-[#DC2626] flex items-center justify-center shadow-xl ring-4 ring-white/30">
                      <XCircle className="w-10 h-10" />
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">BILLET INVALIDE</p>
                    <p className="text-xs font-bold text-white/95">{scanResult.message}</p>
                    <p className="text-[11px] text-white/70 font-mono mt-1">
                      Code inconnu ou non répertorié dans la billetterie
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={clearResult}
                className="w-full py-3 rounded-xl bg-white text-slate-900 font-black text-xs uppercase tracking-wider shadow-lg hover:bg-slate-100 cursor-pointer"
              >
                Valider & Fermer
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 4. Bottom Controls: Manual Code Input & Field Simulator */}
      <footer
        className={`w-full max-w-md mx-auto p-4 border-t shrink-0 flex flex-col gap-3 transition-colors ${
          isDark
            ? 'bg-[#0B1936] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Manual Keyboard Code Input */}
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value.toUpperCase());
                if (manualError) setManualError(null);
              }}
              placeholder="Saisir le code du billet (ex: JT-XXXX-XXXX)"
              className="flex-1 px-3 py-2.5 text-xs font-mono font-bold rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#0038A8] text-white font-bold text-xs hover:bg-[#002D8C] cursor-pointer shadow-xs shrink-0"
            >
              Valider
            </button>
          </div>
          {manualError && (
            <p className="text-[11px] text-red-500 font-semibold px-1">{manualError}</p>
          )}
        </form>

        {/* Manual Code Input Help */}
        <p className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant text-center">
          Saisir le code manuellement ou scanner le QR code
        </p>
      </footer>

      {/* Slide-over Scan History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B1936] text-slate-900 dark:text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-black uppercase tracking-wider font-mono">
                Historique des Scans ({selectedGate})
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-4 pr-1">
              {gateScans.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  Aucun scan enregistré à cette porte.
                </p>
              ) : (
                gateScans.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold font-mono">#{s.ticketCode}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatRelativeTime(s.scannedAt)}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${
                        s.result === 'VALID'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {s.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
