"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Copy, Check, Clock, Video, MessageSquare, Heart, Settings, Wifi, WifiOff, ChevronDown } from "lucide-react"
import { useUser } from "../../../lib/use-user"
import { LiveChat } from "../../components/live-chat"
import { Toast, useToast } from "../../components/ui/toast"
import { io, Socket } from "socket.io-client"
import MuxPlayer from "@mux/mux-player-react";

function StudioTimer({ streamStartedAt, isLive }: { streamStartedAt: string | null, isLive: boolean }) {
    const [uptime, setUptime] = useState("00:00:00");

    useEffect(() => {
        if (!streamStartedAt) {
            setUptime("00:00:00");
            return;
        }

        const format = () => {
            if (!isLive) return; // Pause timer if disconnected
            const start = new Date(streamStartedAt).getTime();
            const diff = Date.now() - start;
            if (diff < 0) return;
            const MathFloor = Math.floor;
            const totalSeconds = MathFloor(diff / 1000);
            const hours = MathFloor(totalSeconds / 3600);
            const minutes = MathFloor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const paddedHours = String(hours).padStart(2, '0');
            const paddedMins = String(minutes).padStart(2, '0');
            const paddedSecs = String(seconds).padStart(2, '0');
            setUptime(`${paddedHours}:${paddedMins}:${paddedSecs}`);
        };

        format();
        const interval = setInterval(format, 1000);
        return () => clearInterval(interval);
    }, [streamStartedAt, isLive]);

    return <span className="text-sm font-bold font-mono text-white tracking-widest">{uptime}</span>;
}

export default function ControlRoomPage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()
    const { toast, showToast, closeToast } = useToast()

    // Chat Configuration State
    const [chatEnabled, setChatEnabled] = useState(true)
    const [slowMode, setSlowMode] = useState(false)

    // Master stream config (static — fetched once from /stream/config)
    const [masterStreamKey, setMasterStreamKey] = useState<string | null>(null)
    const [masterPlaybackId, setMasterPlaybackId] = useState<string | null>(null)
    const [srtPassphrase, setSrtPassphrase] = useState<string | null>(null)
    const [isGeneratingKey, setIsGeneratingKey] = useState(false)
    const [needsConfig, setNeedsConfig] = useState(false)

    // Live event state (populated by webhook via socket when OBS connects)
    const [playbackId, setPlaybackId] = useState<string | null>(null)
    const [eventId, setEventId] = useState<string | null>(null)
    const [eventStreamKey, setEventStreamKey] = useState<string | null>(null)
    const [isLive, setIsLive] = useState(false)
    const [isPublished, setIsPublished] = useState(false)
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [copied, setCopied] = useState(false)
    const [streamStartedAt, setStreamStartedAt] = useState<string | null>(null)
    const [diagnosticLogs, setDiagnosticLogs] = useState<{ time: string, message: string }[]>([])
    const [viewerCount, setViewerCount] = useState<number>(0)
    const [isPublishing, setIsPublishing] = useState(false)
    const [obsStatus, setObsStatus] = useState<'connecting' | 'live' | 'offline'>('offline')

    // Engagement Stats State
    const [peakViewers, setPeakViewers] = useState<number>(0)
    const [chatMessages, setChatMessages] = useState<number>(0)
    const [reactions, setReactions] = useState<number>(0)
    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [streamError, setStreamError] = useState<{ message: string, code: string } | null>(null)
    const [socketConnected, setSocketConnected] = useState(false)
    const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)
    const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'health' | 'stats' | 'controls'>('chat')
    const [isConfigExpanded, setIsConfigExpanded] = useState(false)
    const [encoderConnected, setEncoderConnected] = useState(false)
    const [checkingEncoderStatus, setCheckingEncoderStatus] = useState(false)

    const socketRef = useRef<Socket | null>(null)
    const isFetchingLiveStatusRef = useRef(false)
    const isFetchingConfigRef = useRef(false)
    const lastLiveStatusFetchRef = useRef<number>(0)
    const lastConfigFetchRef = useRef<number>(0)
    const encoderStatusIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // ---------------------------------------------------------------
    // Helper: Check if encoder is actually connected to Mux
    // ---------------------------------------------------------------
    const checkEncoderStatus = useRef(() => {
        if (!eventId || checkingEncoderStatus) return;

        setCheckingEncoderStatus(true);
        const token = localStorage.getItem('token');
        
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/status?eventId=${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setEncoderConnected(data.isConnected || false);
                // Update obsStatus to 'live' when encoder is detected
                if (data.isConnected) {
                    setObsStatus('live');
                }
                console.log('[Encoder Status]', data);
            })
            .catch(err => console.error('[Encoder Status] Error:', err))
            .finally(() => setCheckingEncoderStatus(false));
    });

    // ---------------------------------------------------------------
    // Helper: Join the event's socket room once we know the eventId
    // ---------------------------------------------------------------
    const joinEventRoom = (eid: string, socket: Socket) => {
        socket.emit("join-room", eid);
    };

    const handleGenerateMasterKey = async () => {
        setIsGeneratingKey(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/setup-master-stream`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            const data = await res.json()
            console.log('[Master Stream] Response:', { status: res.status, ok: res.ok, data })
            
            if (res.ok) {
                console.log('[Master Stream] Setting state:', { 
                    masterStreamKey: data.masterStreamKey, 
                    masterPlaybackId: data.masterPlaybackId,
                    srtPassphrase: data.srtPassphrase 
                })
                setMasterStreamKey(data.masterStreamKey)
                setMasterPlaybackId(data.masterPlaybackId)
                if (data.srtPassphrase) setSrtPassphrase(data.srtPassphrase)
                console.log('[Master Stream] About to set needsConfig to false')
                setNeedsConfig(false)
                console.log('[Master Stream] needsConfig set to false')
                showToast("Master Stream Key successfully generated!", "success")
            } else {
                console.error('[Master Stream] Error response:', data)
                showToast(data.error || "Failed to generate master stream key", "error")
            }
        } catch (error) {
            console.error('[Master Stream] Catch error:', error)
            showToast("Error generating master stream key", "error")
        } finally {
            setIsGeneratingKey(false)
        }
    }

    // 2. Fetcher for live stream status
    const loadLiveStatus = useRef(() => {
        // Prevent concurrent requests - skip if already fetching
        if (isFetchingLiveStatusRef.current) {
            console.log('[Live Status] Already fetching, skipping...')
            return
        }

        // Rate limit: don't fetch more than once per 2 seconds
        const now = Date.now()
        if (now - lastLiveStatusFetchRef.current < 2000) {
            console.log('[Live Status] Rate limited, skipping...')
            return
        }

        isFetchingLiveStatusRef.current = true
        lastLiveStatusFetchRef.current = now

        const token = localStorage.getItem('token')
        const headers = { 'Authorization': `Bearer ${token}` }
        
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/live`, { headers })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    // Capture specific error codes for diagnostics
                    if (data.code && data.code !== 'NO_LIVE_STREAM') {
                        setStreamError({ message: data.message, code: data.code });
                    }
                    return null;
                }
                setStreamError(null);
                return data;
            })
            .then(data => {
                if (!data) return;
                if (data.id) {
                    setEventId(data.id);
                    setIsLive(data.isLive ?? false);
                    setIsPublished(data.isPublished ?? false);
                    setObsStatus(data.isLive ? 'live' : 'offline');
                }
                if (data.playbackId) setPlaybackId(data.playbackId);
                if (data.muxStreamKey) setEventStreamKey(data.muxStreamKey); // Sync event stream key from backend
                if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl);
                if (data.streamStartedAt) setStreamStartedAt(data.streamStartedAt);
                if (data.chatEnabled !== undefined) setChatEnabled(data.chatEnabled);
                if (data.slowMode !== undefined) setSlowMode(data.slowMode);
            })
            .catch(err => {
                console.error('[Live Status] Error:', err);
                setStreamError({ message: "Failed to connect to the server. Please check your internet.", code: "FETCH_ERROR" });
            })
            .finally(() => {
                isFetchingLiveStatusRef.current = false
            });
    });

    useEffect(() => {
        if (!loading && !hasRole(["MEDIA", "ADMIN"])) {
            router.push("/")
            return
        }

        if (!hasRole(["MEDIA", "ADMIN"])) return

        const token = localStorage.getItem('token')
        const headers = { 'Authorization': `Bearer ${token}` }

        // Fetch current stream's muxStreamKey immediately on mount
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/live`, { headers })
            .then(res => {
                if (!res.ok) return null
                return res.json()
            })
            .then(data => {
                if (data?.muxStreamKey) {
                    setEventStreamKey(data.muxStreamKey) // Always use current stream's key
                }
            })
            .catch(err => console.error('[Fetch Stream Key] Error:', err))

        // 1. Fetch static master OBS config (stream key + RTMP URL)
        // Skip if already fetching or if too recent
        if (isFetchingConfigRef.current || (Date.now() - lastConfigFetchRef.current) < 2000) {
            console.log('[Config] Already fetching or rate limited, skipping...')
        } else {
            setIsLoadingConfig(true)
            isFetchingConfigRef.current = true
            lastConfigFetchRef.current = Date.now()
            
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/config`, { headers })
                .then(res => {
                    if (res.status === 404) {
                        setNeedsConfig(true)
                        return null
                    }
                    return res.json()
                })
                .then(data => {
                    if (!data) {
                        setIsLoadingConfig(false)
                        return
                    }
                    if (data.masterStreamKey) setMasterStreamKey(data.masterStreamKey)
                    if (data.masterPlaybackId) setMasterPlaybackId(data.masterPlaybackId)
                    if (data.srtPassphrase) setSrtPassphrase(data.srtPassphrase)
                    setNeedsConfig(false)
                    setIsLoadingConfig(false)
                })
                .catch(err => {
                    console.error('[Config] Error:', err)
                    setIsLoadingConfig(false)
                })
                .finally(() => {
                    isFetchingConfigRef.current = false
                })
        }

        // Initial load
        loadLiveStatus.current();

    }, [hasRole, loading, router])

    // Socket.io Setup — ONLY RUN ONCE on mount, never reconnect
    useEffect(() => {
        if (!hasRole(["MEDIA", "ADMIN"])) return

        // 3. Set up Socket.io
        if (!socketRef.current) {
            const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");
            socketRef.current = socket;

            socket.on("connect", () => setSocketConnected(true));
            socket.on("disconnect", () => setSocketConnected(false));
            socket.on("connect_error", () => {
                setSocketConnected(false);
                setStreamError(prev => prev?.code === 'FETCH_ERROR' ? prev : { message: "Real-time connection lost.", code: "SOCKET_ERROR" });
            });

            // Join global control-room room — receives events before we have an eventId
            socket.emit("join-room", "control-room");

            // OBS connected → webhook auto-created/activated an event
            socket.on("stream-went-live", (payload: any) => {
                console.log("[Socket] stream-went-live:", payload);
                // Silence refresh the whole state to ensure everything (timers, IDs) is correct
                loadLiveStatus.current();
            });

            // OBS disconnected → webhook ended the event
            socket.on("stream-ended", (payload: any) => {
                console.log("[Socket] stream-ended:", payload);
                setIsLive(false);
                setIsPublished(false);
                setObsStatus('offline');
                setEventStreamKey(null); // Clear event stream key when stream ends
            });

            // Generic status changes (publish, unpublish, etc.)
            socket.on("stream-status-changed", (payload: any) => {
                // DO NOT touch isLive here — that is governed purely by the OBS connection.
                // Modifying it causes React to remount the MuxPlayer wrapper.
                if (payload.isPublished !== undefined) setIsPublished(payload.isPublished);
            });

            socket.on("stream-preview-ready", () => { setIsPublished(false); });

            socket.on("stream-published", () => { setIsPublished(true); });

            socket.on("stream-diagnostic", (payload: { type: string, message: string }) => {
                const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
                setDiagnosticLogs(prev => [...prev, { time: timestamp, message: payload.message }]);

                if (payload.type === 'STREAM_WARNING' || payload.type === 'STREAM_DISCONNECTED') setObsStatus('connecting');
                if (payload.type === 'STREAM_ACTIVE') {
                    setObsStatus('live');
                    loadLiveStatus.current(); // Refresh on active signal too
                }
            });

            socket.on("viewer-count-updated", (count: number) => {
                setViewerCount(count);
                setPeakViewers(prev => Math.max(prev, count));
            });

            // Fallbacks for the custom Publish/Unpublish global events if needed
            socket.on("STREAM_PUBLISHED", () => { setIsPublished(true); });
            socket.on("STREAM_UNPUBLISHED", () => { setIsPublished(false); });
            socket.on("STREAM_ENDED", () => { setIsLive(false); setIsPublished(false); setObsStatus('offline'); });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [])

    // --- PROACTIVE POLLING: If not live, check every 10s back against the synced server ---
    useEffect(() => {
        if (obsStatus === 'live') return;

        const interval = setInterval(() => {
            console.log("[POLLING] Checking for live stream status...");
            loadLiveStatus.current();
        }, 10000);

        return () => clearInterval(interval);
    }, [obsStatus]);

    // Poll engagement stats while the event is active
    // TODO: Implement /stream/:id/stats endpoint on backend
    /*
    useEffect(() => {
        if (!eventId) return;

        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/${eventId}/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setChatMessages(data.chatMessages);
                    setReactions(data.reactions);
                }
            } catch (err) {
                console.error("Failed to fetch stream stats", err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [eventId]);
    */

    // Auto-trigger diagnostic modal if a critical error is detected
    useEffect(() => {
        if (streamError && (
            streamError.code === 'MUX_STREAM_NOT_FOUND' ||
            streamError.code === 'MUX_ACTIVE_NO_EVENT' ||
            streamError.code === 'FETCH_ERROR'
        )) {
            setShowDiagnosticModal(true);
        }
    }, [streamError]);

    // Join the event room whenever we get an eventId via the socket
    useEffect(() => {
        if (eventId && socketRef.current) {
            joinEventRoom(eventId, socketRef.current);
        }
    }, [eventId]);

    const handleStreamSettingUpdate = async (setting: { chatEnabled?: boolean, slowMode?: boolean }) => {
        if (!eventId) return;
        if (setting.chatEnabled !== undefined) setChatEnabled(setting.chatEnabled);
        if (setting.slowMode !== undefined) setSlowMode(setting.slowMode);

        try {
            const token = localStorage.getItem('token');
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/${eventId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(setting)
            });
        } catch (error) {
            console.error("Failed to update stream setting", error);
        }
    };

    const handleEndStream = async () => {
        if (!eventId) return
        if (!confirm("Are you sure you want to end the live stream?")) return

        try {
            if (encoderStatusIntervalRef.current) {
                clearInterval(encoderStatusIntervalRef.current);
                encoderStatusIntervalRef.current = null;
            }
            setObsStatus('offline') // Resume polling
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ eventId })
            })

            if (res.ok) {
                setEventStreamKey(null) // Clear event stream key when stream ends
                router.push("/dashboard")
            } else {
                const data = await res.json()
                showToast(data.error || "Failed to end stream", "error")
            }
        } catch (error) {
            console.error(error)
            showToast("Error ending stream", "error")
        }
    }

    const handleStartStreamEvent = async () => {
        try {
            setIsLoadingConfig(true)
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title: 'Live Stream', description: '', isPublic: false })
            })

            const data = await res.json()
            if (res.ok) {
                console.log('[Start Stream Event] Created:', { eventId: data.eventId, playbackId: data.playbackId, streamKey: data.streamKey })
                setEventId(data.eventId)
                setPlaybackId(data.playbackId)
                setEventStreamKey(data.streamKey) // Capture the event-specific stream key
                setIsLive(true)
                setObsStatus('connecting') // Stop polling loop until encoder is detected
                setEncoderConnected(false)
                showToast("Stream event created! Start streaming now from OBS/ffmpeg.", "success")
                
                // Start polling for encoder connection (check every 3 seconds)
                if (encoderStatusIntervalRef.current) clearInterval(encoderStatusIntervalRef.current);
                checkEncoderStatus.current();
                encoderStatusIntervalRef.current = setInterval(() => {
                    checkEncoderStatus.current();
                }, 3000);
            } else {
                showToast(data.error || "Failed to create stream event", "error")
            }
        } catch (err) {
            console.error('[Start Stream Event] Error:', err)
            showToast("Error creating stream event", "error")
        } finally {
            setIsLoadingConfig(false)
        }
    }

    const handlePublish = async () => {
        if (!eventId || isPublishing) return
        setIsPublishing(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ eventId })
            })
            if (res.ok) {
                setIsPublished(true)
            } else {
                const data = await res.json()
                showToast(data.error || "Failed to publish stream", "error")
            }
        } catch (err) {
            console.error(err)
            showToast("Error publishing stream", "error")
        } finally {
            setIsPublishing(false)
        }
    }

    const handleUnpublish = async () => {
        if (!eventId || isPublishing) return
        setIsPublishing(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/unpublish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ eventId })
            })
            if (res.ok) {
                setIsPublished(false)
            } else {
                const data = await res.json()
                showToast(data.error || "Failed to unpublish stream", "error")
            }
        } catch (err) {
            console.error(err)
            showToast("Error unpublishing stream", "error")
        } finally {
            setIsPublishing(false)
        }
    }

    const copyToClipboard = (text: string) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Only use actual event playbackId — NEVER use masterPlaybackId for playback
    // Master stream is for OBS ingest only, not for display
    const activePlaybackId = playbackId || null;

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null

    return (
        <div className="-mx-4 -my-8 h-[calc(100vh-73px)] bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden">
            {/* Header Status Bar — Premium Glass Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0 z-30">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            {isLive && isPublished && obsStatus === 'live' ? (
                                <span className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    Live
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest border border-white/10">
                                    Offline
                                </span>
                            )}
                            <h1 className="text-sm font-bold text-white/90">Studio Control Room</h1>
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-white/5 mx-2" />

                    {/* OBS Connection Status */}
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-full ${obsStatus === 'live' ? 'bg-green-500/10' : obsStatus === 'connecting' ? 'bg-yellow-500/10' : 'bg-white/5'}`}>
                                {obsStatus === 'live' ? <Wifi className="h-3.5 w-3.5 text-green-400" /> : <WifiOff className="h-3.5 w-3.5 text-white/20" />}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter leading-none">Encoder Status</span>
                                <span className={`text-[11px] font-bold ${obsStatus === 'live' ? 'text-green-400' : 'text-white/40'}`}>
                                    {obsStatus === 'live' ? 'Connected & Healthy' : obsStatus === 'connecting' ? 'Signal Lagging...' : 'Waiting for Signal'}
                                </span>
                            </div>
                        </div>

                        {isLive && (
                            <>
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-full bg-white/5">
                                        <Eye className="h-3.5 w-3.5 text-white/40" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter leading-none">Viewers</span>
                                        <span className="text-[11px] font-bold text-white/80">{viewerCount.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-full bg-white/5">
                                        <Clock className="h-3.5 w-3.5 text-white/40" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-tighter leading-none">Session Uptime</span>
                                        <StudioTimer streamStartedAt={streamStartedAt} isLive={obsStatus === 'live'} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isLive && (
                        <button
                            onClick={handleEndStream}
                            className="px-5 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-red-500 text-[11px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
                        >
                            End Session
                        </button>
                    )}

                    <button
                        onClick={() => setShowDiagnosticModal(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all
                            ${streamError
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
                                : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                            }`}
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Diagnostics
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] flex-1 min-h-0 bg-[#050505]">
                {/* Main Content Area */}
                <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                    {/* Live Preview */}
                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 flex flex-col flex-1 min-h-0">
                        <div className="flex items-center gap-2 mb-4 shrink-0">
                            <Video className="h-4 w-4 text-white/50" />
                            <h2 className="text-sm font-bold">Live Preview</h2>
                        </div>

                        {/* Single container — never changes its DOM structure */}
                        <div className="relative w-full flex-1 min-h-[300px] bg-black rounded-lg overflow-hidden">

                            {/* ── LAYER 1: Waiting Slate (absolute, behind player) ── */}
                            <div className={`absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-4 text-center px-8 transition-opacity duration-500
                                ${(isLive && obsStatus === 'live' && activePlaybackId) ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                            `}>
                                <div className="p-5 rounded-full bg-zinc-800 border border-white/10">
                                    <Video className="h-10 w-10 text-white/30" />
                                </div>
                                <div>
                                    <p className="text-white/80 font-semibold text-base">Waiting for Encoder Signal...</p>
                                    <p className="text-white/30 text-sm mt-1">When OBS starts streaming and Mux establishes a connection, this preview will activate automatically.</p>
                                    <button
                                        onClick={() => setShowDiagnosticModal(true)}
                                        className="text-brand-purple hover:text-brand-purple/80 text-xs font-medium mt-2 underline underline-offset-4 decoration-current/30 hover:decoration-current"
                                    >
                                        Having trouble? Run diagnostics
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 border border-white/10">
                                    <span className="h-2 w-2 rounded-full bg-white/20 animate-pulse" />
                                    <span className="text-xs text-white/30 font-medium">
                                        {obsStatus === 'connecting' ? 'CONNECTING TO MUX...' : socketConnected ? 'WAITING FOR OBS SIGNAL' : 'RECONNECTING TO SERVER...'}
                                    </span>
                                </div>
                            </div>

                            {/* ── LAYER 2: MuxPlayer — mounted ONLY when signal is live to prevent caching ── */}
                            {/* Key is ONLY the playbackId, but mounting depends on current signal status */}
                            {activePlaybackId && isLive && obsStatus === 'live' && (
                                <div
                                    key={activePlaybackId}
                                    className="absolute inset-0"
                                >
                                    <MuxPlayer
                                        playbackId={activePlaybackId}
                                        streamType="ll-live"
                                        autoPlay="muted"
                                        muted={true}
                                        poster=""
                                        accentColor="#A828FF"
                                        style={{ height: '100%', width: '100%' }}
                                        onError={(err) => {
                                            console.error("MuxPlayer Error:", err);
                                            setStreamError({ message: "Playback error. Mux could not load the stream.", code: "MUX_PLAYER_ERROR" });
                                        }}
                                    />
                                </div>
                            )}

                            {/* ── LAYER 3: Status badge (top-left) — CSS only, never unmounts ── */}
                            <div className="absolute top-3 left-3 z-20 pointer-events-none">
                                {isLive && obsStatus === 'live' && (
                                    !isPublished ? (
                                        <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/40 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                                            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                                            <span className="text-yellow-300 font-bold text-xs uppercase tracking-wider">Preview Mode — Hidden from public</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/40 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                                            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-red-400 font-bold text-xs uppercase tracking-wider">Live to Public</span>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* ── LAYER 4: Go Live / Stop button (bottom-center) ── */}
                            {isLive && obsStatus === 'live' && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                                    {!isPublished ? (
                                        <button
                                            onClick={handlePublish}
                                            disabled={isPublishing}
                                            className="flex items-center gap-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:shadow-[0_0_40px_rgba(239,68,68,0.7)] transition-all animate-pulse hover:animate-none"
                                        >
                                            <span className="h-2.5 w-2.5 rounded-full bg-white" />
                                            {isPublishing ? "Publishing..." : "Go Live to Public"}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleUnpublish}
                                            disabled={isPublishing}
                                            className="flex items-center gap-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/20 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg"
                                        >
                                            <span className="h-2.5 w-2.5 rounded-full bg-red-500 border border-red-200" />
                                            {isPublishing ? "Updating..." : "Stop Public Stream"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* OBS Configuration — always visible, credentials never change */}
                    <ObsConfigCard
                        masterStreamKey={eventStreamKey || masterStreamKey}
                        masterPlaybackId={masterPlaybackId}
                        srtPassphrase={srtPassphrase}
                        isLoadingConfig={isLoadingConfig}
                        isGeneratingKey={isGeneratingKey}
                        onGenerate={handleGenerateMasterKey}
                    />

                    {/* Start Stream Event Button — shown after key is generated */}
                    {masterStreamKey && !isLive && (
                        <div className="mt-6 p-6 bg-gradient-to-br from-brand-purple/10 to-brand-purple/5 border border-brand-purple/20 rounded-2xl space-y-4">
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-white">Ready to Stream?</h3>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    Your OBS credentials are ready. To start streaming, you need to:
                                </p>
                                <ol className="text-xs text-white/50 space-y-1.5 list-decimal list-inside">
                                    <li>Click the button below to create a stream event</li>
                                    <li>Start streaming from your encoder (OBS/ffmpeg)</li>
                                    <li>The preview will appear once we detect your stream</li>
                                </ol>
                            </div>
                            <button
                                onClick={handleStartStreamEvent}
                                disabled={isLoadingConfig}
                                className="w-full bg-brand-purple hover:bg-brand-purple/80 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-lg transition-all text-sm"
                            >
                                {isLoadingConfig ? "Creating Stream Event..." : "Start Stream Event"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Sidebar — Tabbed and Organized */}
                <div className="bg-[#080808] border-l border-white/5 flex flex-col h-full overflow-hidden">
                    {/* Sidebar Tabs Navigation */}
                    <div className="flex border-b border-white/5 bg-black/20 shrink-0">
                        <SidebarTab
                            active={activeSidebarTab === 'chat'}
                            onClick={() => setActiveSidebarTab('chat')}
                            icon={<MessageSquare className="h-4 w-4" />}
                            label="Live Chat"
                        />
                        <SidebarTab
                            active={activeSidebarTab === 'health'}
                            onClick={() => setActiveSidebarTab('health')}
                            icon={<Wifi className="h-4 w-4" />}
                            label="Health"
                        />
                        <SidebarTab
                            active={activeSidebarTab === 'stats'}
                            onClick={() => setActiveSidebarTab('stats')}
                            icon={<Settings className="h-4 w-4" />}
                            label="Controls"
                        />
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeSidebarTab === 'chat' && (
                            <div className="flex-1 flex flex-col min-h-0 bg-black/10">
                                <LiveChat />
                            </div>
                        )}

                        {activeSidebarTab === 'health' && (
                            <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-black/10 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Diagnostic Logs</h3>
                                    <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[11px] h-[300px] overflow-y-auto space-y-2">
                                        {diagnosticLogs.length === 0 ? (
                                            <div className="text-white/20 italic flex items-center justify-center h-full gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-white/10 animate-pulse" />
                                                Listening for stream signals...
                                            </div>
                                        ) : (
                                            diagnosticLogs.map((log, i) => (
                                                <div key={i} className="flex gap-3 leading-relaxed border-b border-white/[0.02] pb-1.5">
                                                    <span className="text-white/20 shrink-0">{log.time}</span>
                                                    <span className={log.message.includes('🟢') ? 'text-green-400' : log.message.includes('🔴') ? 'text-red-400' : 'text-white/60'}>
                                                        {log.message}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Network Blueprint</h3>
                                    <DiagnosticRow label="Socket" status={socketConnected ? 'ok' : 'error'} message={socketConnected ? 'DGCLive HQ Online' : 'Signal Lost'} />
                                    <DiagnosticRow label="Mux Engine" status={activePlaybackId ? 'ok' : 'warning'} message={activePlaybackId ? 'Engine Armed' : 'Provisioning...'} />
                                </div>
                            </div>
                        )}

                        {activeSidebarTab === 'stats' && (
                            <div className="p-6 space-y-8 flex-1 overflow-y-auto bg-black/10 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Engagement Matrix</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <StatCard label="Peak Viewers" value={peakViewers} icon={<Eye className="h-4 w-4" />} />
                                        <StatCard label="Messages" value={chatMessages} icon={<MessageSquare className="h-4 w-4" />} />
                                        <StatCard label="Reactions" value={reactions} icon={<Heart className="h-4 w-4" />} />
                                        <StatCard label="Uptime" value={isLive ? 'Active' : 'Offline'} icon={<Clock className="h-4 w-4" />} />
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-white/5">
                                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Interactivity Controls</h3>
                                    <div className="space-y-4">
                                        <ControlRow
                                            label="Live Public Chat"
                                            description="Allow viewers to send messages"
                                            checked={chatEnabled}
                                            onChange={() => handleStreamSettingUpdate({ chatEnabled: !chatEnabled })}
                                        />
                                        <ControlRow
                                            label="Slow Mode"
                                            description="Limit message frequency (60s)"
                                            checked={slowMode}
                                            onChange={() => handleStreamSettingUpdate({ slowMode: !slowMode })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 404 Master Config Modal Overlay */}
            {needsConfig && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center gap-6 shadow-2xl">
                        <div className="p-4 bg-brand-purple/20 rounded-full">
                            <Video className="w-8 h-8 text-brand-purple" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2">Initial Setup Required</h2>
                            <p className="text-white/60 text-sm leading-relaxed">
                                Welcome to the Control Room. To start broadcasting, you need to provision a persistent master stream connection with Mux.
                            </p>
                        </div>
                        <button
                            onClick={handleGenerateMasterKey}
                            disabled={isGeneratingKey}
                            className="w-full bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex justify-center items-center gap-2"
                        >
                            {isGeneratingKey && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isGeneratingKey ? "Provisioning..." : "Generate Stream Key"}
                        </button>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

            {/* Diagnostic Modal */}
            {showDiagnosticModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-zinc-950/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <Wifi className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white leading-none">Diagnostic Center</h2>
                                    <p className="text-xs text-white/40 mt-1.5">Checking your stream health</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDiagnosticModal(false)}
                                className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-colors"
                            >
                                <EyeOff className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Checkpoints */}
                            <div className="space-y-4">
                                <DiagnosticRow
                                    label="Server Connection"
                                    status={socketConnected ? 'ok' : 'error'}
                                    message={socketConnected ? 'Connected to DGCLive HQ' : 'Attempting to reconnect...'}
                                />
                                <DiagnosticRow
                                    label="Mux Configuration"
                                    status={!masterStreamKey ? 'warning' : 'ok'}
                                    message={masterStreamKey ? 'Stream credentials verified' : 'Provisioning incomplete'}
                                />
                                <DiagnosticRow
                                    label="Signal Health"
                                    status={obsStatus === 'live' ? 'ok' : 'warning'}
                                    message={obsStatus === 'live' ? 'Signal detected' : 'Waiting for encoder (OBS)'}
                                />
                            </div>

                            {/* Active Error Box */}
                            {streamError && (
                                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5 space-y-3">
                                    <div className="flex items-start gap-4">
                                        <WifiOff className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-red-400">Error: {streamError.code}</p>
                                            <p className="text-sm text-red-400/80 mt-1 leading-relaxed">
                                                {streamError.message}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pl-9 space-y-2">
                                        <p className="text-[11px] text-white/40 uppercase font-bold tracking-wider">Suggested Actions:</p>
                                        <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
                                            {streamError.code === 'MUX_ACTIVE_NO_EVENT' && (
                                                <>
                                                    <li>Click 'Go to Dashboard' and try starting a new service.</li>
                                                    <li>Refresh this page and start OBS again.</li>
                                                </>
                                            )}
                                            {streamError.code === 'MUX_STREAM_NOT_FOUND' && (
                                                <li>Your master stream was deleted on Mux. You must re-provision.</li>
                                            )}
                                            {streamError.code === 'SOCKET_ERROR' && (
                                                <li>Check your internet connection.</li>
                                            )}
                                            {streamError.code === 'FETCH_ERROR' && (
                                                <li>The backend server is currently unreachable.</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {!streamError && obsStatus !== 'live' && (
                                <div className="bg-brand-purple/5 border border-brand-purple/10 rounded-xl p-5">
                                    <p className="text-sm text-brand-purple/70 leading-relaxed font-medium text-center">
                                        Everything looks good on our end. If you haven't yet, press <span className="text-white font-bold">"Start Streaming"</span> in OBS using the credentials below.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-zinc-950/50 border-t border-white/5 flex gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-white hover:bg-neutral-200 text-black font-bold py-3 rounded-xl transition-all text-sm"
                            >
                                Refresh Connection
                            </button>
                            {streamError?.code === 'MUX_STREAM_NOT_FOUND' && (
                                <button
                                    onClick={() => { setShowDiagnosticModal(false); setNeedsConfig(true); }}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
                                >
                                    Re-provision Stream
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function DiagnosticRow({ label, status, message }: { label: string, status: 'ok' | 'error' | 'warning', message: string }) {
    return (
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1.5">{label}</span>
                <span className="text-sm font-medium text-white/80">{message}</span>
            </div>
            <div className={`h-2.5 w-2.5 rounded-full ${status === 'ok' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                    'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                }`} />
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
    return (
        <div
            onClick={onChange}
            className={`w-9 h-5 rounded-full cursor-pointer relative transition-colors ${checked ? 'bg-brand-purple' : 'bg-white/20'}`}
        >
            <div className={`absolute top-1 bottom-1 w-3 rounded-full bg-white transition-all shadow-sm ${checked ? 'left-5' : 'left-1'}`}></div>
        </div>
    )
}

// ---------------------------------------------------------------
// OBS CONFIGURATION CARD — Self-contained with per-field copy UX
// ---------------------------------------------------------------
type CopiedField = 'srt' | 'rtmp' | 'key' | null

function ObsConfigCard({
    masterStreamKey,
    masterPlaybackId,
    srtPassphrase,
    isLoadingConfig,
    isGeneratingKey,
    onGenerate,
}: {
    masterStreamKey: string | null
    masterPlaybackId: string | null
    srtPassphrase: string | null
    isLoadingConfig: boolean
    isGeneratingKey: boolean
    onGenerate: () => void
}) {
    const [isConfigExpanded, setIsConfigExpanded] = useState(false)
    const [showKey, setShowKey] = useState(false)
    const [copiedField, setCopiedField] = useState<CopiedField>(null)

    const copy = (value: string, field: CopiedField) => {
        navigator.clipboard.writeText(value).catch(() => { })
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const srtUrl = masterStreamKey && srtPassphrase
        ? `srt://global-live.mux.com:6001?streamid=${masterStreamKey}&passphrase=${srtPassphrase}`
        : null
    const rtmpUrl = 'rtmp://global-live.mux.com:5222/app'
    const ffmpegRtmpUrl = masterStreamKey ? `${rtmpUrl}/${masterStreamKey}` : null

    const hasCredentials = Boolean(masterStreamKey)

    return (
        <div className="shrink-0">
            {/* Compact OBS Config Card */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                <button
                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-purple/10 border border-brand-purple/20">
                            <Settings className="h-4 w-4 text-brand-purple" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest leading-none">OBS Settings</h3>
                            <p className="text-[10px] text-white/30 mt-1.5 font-medium uppercase tracking-tight">Stream Key & Encoder URLs</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {hasCredentials && (
                            <span className="flex items-center gap-1.5 text-[9px] text-green-400 font-black uppercase tracking-widest">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
                                Active
                            </span>
                        )}
                        <div className={`p-1.5 rounded-md bg-white/5 text-white/30 transition-transform duration-300 ${isConfigExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                    </div>
                </button>

                {isConfigExpanded && (
                    <div className="px-6 pb-6 pt-2 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Row: SRT (only shown when available) */}
                        {srtUrl && (
                            <CredentialRow
                                label="SRT Server URL (Recommended)"
                                value={showKey ? srtUrl : 'srt://global-live.mux.com:6001?streamid=••••••••&passphrase=••••••••'}
                                onCopy={() => copy(srtUrl, 'srt')}
                                isCopied={copiedField === 'srt'}
                                hint="Paste into OBS → Settings → Stream → Server"
                            />
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <CredentialRow
                                label="RTMP Server"
                                value={hasCredentials ? rtmpUrl : undefined}
                                placeholder={isLoadingConfig ? 'Loading...' : 'Generate key first'}
                                onCopy={() => copy(rtmpUrl, 'rtmp')}
                                isCopied={copiedField === 'rtmp'}
                                disabled={!hasCredentials}
                            />

                            {hasCredentials && masterStreamKey && (
                                <CredentialRow
                                    label="Stream Key"
                                    value={showKey ? masterStreamKey : '••••••••••••••••••••••••'}
                                    onCopy={() => copy(masterStreamKey, 'key')}
                                    isCopied={copiedField === 'key'}
                                    extraAction={
                                        <button
                                            onClick={() => setShowKey(v => !v)}
                                            className="p-1.5 rounded-md text-white/30 hover:text-white"
                                        >
                                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    }
                                />
                            )}
                        </div>

                        {/* FFmpeg Combined URL */}
                        {ffmpegRtmpUrl && (
                            <CredentialRow
                                label="FFmpeg RTMP URL (Combined)"
                                value={showKey ? ffmpegRtmpUrl : 'rtmp://global-live.mux.com:5222/app/••••••••••••••••••••••••'}
                                onCopy={() => copy(ffmpegRtmpUrl, 'rtmp')}
                                isCopied={copiedField === 'rtmp'}
                                hint="Use this for ffmpeg: ffmpeg ... -f flv [this URL]"
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------
// CREDENTIAL ROW — Reusable field with copy feedback
// ---------------------------------------------------------------
function CredentialRow({
    label,
    badge,
    badgeColor = 'text-white/50',
    value,
    placeholder,
    hint,
    onCopy,
    isCopied,
    disabled = false,
    extraAction,
}: {
    label: string
    badge?: string
    badgeColor?: string
    value?: string
    placeholder?: string
    hint?: string
    onCopy: () => void
    isCopied: boolean
    disabled?: boolean
    extraAction?: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            {/* Label row */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
                {badge && <span className={`text-[9px] font-semibold uppercase tracking-wide ${badgeColor}`}>• {badge}</span>}
            </div>
            {/* Input row */}
            <div className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 border transition-colors min-w-0
                ${disabled
                    ? 'bg-neutral-950 border-neutral-800 cursor-not-allowed'
                    : 'bg-black border-neutral-700 hover:border-neutral-500'
                }`}
            >
                <code className={`text-xs font-mono truncate flex-1 min-w-0 select-all ${disabled ? 'text-white/20' : 'text-white/70'}`}>
                    {value ?? <span className="italic text-white/20">{placeholder}</span>}
                </code>
                {/* Extra action slot (e.g. show/hide) */}
                {extraAction}
                {/* Copy button */}
                {!disabled && (
                    <button
                        onClick={onCopy}
                        title={isCopied ? 'Copied!' : `Copy ${label}`}
                        className={`p-1.5 rounded-md flex-shrink-0 transition-all
                            ${isCopied
                                ? 'text-green-400 bg-green-400/10'
                                : 'text-white/25 hover:text-white hover:bg-white/5 group-hover:text-white/50'
                            }`}
                    >
                        {isCopied
                            ? <Check className="h-3.5 w-3.5" />
                            : <Copy className="h-3.5 w-3.5" />
                        }
                    </button>
                )}
            </div>
            {hint && <p className="text-[10px] text-white/20 pl-0.5">{hint}</p>}
        </div>
    )
}
// ---------------------------------------------------------------
// SIDEBAR HELPERS
// ---------------------------------------------------------------

function SidebarTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex flex-col items-center justify-center py-4 gap-1.5 border-b-2 transition-all
                ${active
                    ? 'border-brand-purple bg-brand-purple/5 text-white'
                    : 'border-transparent text-white/20 hover:text-white/40 hover:bg-white/[0.02]'
                }`}
        >
            {icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    )
}

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white/20">
                {icon}
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white/90">{value.toLocaleString()}</span>
        </div>
    )
}

function ControlRow({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) {
    return (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-white/80 tracking-tight">{label}</span>
                <span className="text-[10px] text-white/30 font-medium">{description}</span>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    )
}
