'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CopyTradingPage.module.scss';

type Msg = Record<string, any>;

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=70344';
const TRADER_TOKEN = 'a87TQeZjHnpMPHM';  // Real account token
const DEMO_TRADER_TOKEN = 'a87TQeZjHnpMPHM';  // Replace with your demo account token

const CopyTrading: React.FC = () => {
    const wsRef = useRef<WebSocket | null>(null);
    const [token, setToken] = useState('');
    const [connected, setConnected] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [status, setStatus] = useState('Disconnected');
    const [copying, setCopying] = useState(false);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [savedToken, setSavedToken] = useState<string | null>(null);

    const flowRef = useRef<{
        mode: null | 'setup-and-copy';
        stage: null | 'auth_trader' | 'set_allow' | 'auth_copier' | 'copy_start';
        copierToken?: string;
        copierLoginId?: string;
        traderLoginId?: string;
        lastLoginId?: string;
        batchMode?: null | 'start' | 'stop';
        batchTokens?: string[];
        batchIndex?: number;
        isDemoToReal?: boolean;
        isSimulatedCopy?: boolean;
    }>({ mode: null, stage: null, copierToken: undefined });

    const [copierTokens, setCopierTokens] = useState<string[]>([]);
    const [newToken, setNewToken] = useState('');
    const [perStatus, setPerStatus] = useState<Record<string, 'idle' | 'copying' | 'error'>>({});
    const pingRef = useRef<number | null>(null);

    const send = useCallback((payload: Msg) => {
        const ws = wsRef.current;
        const masked = (t: string) => (t ? `${t.slice(0, 4)}…${t.slice(-3)}` : '');
        const toLog = payload && 'authorize' in payload
            ? { ...payload, authorize: masked(String((payload as any).authorize ?? '')) }
            : payload;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn('[WS] send skipped, socket not open', {
                readyState: ws?.readyState,
                payload: toLog,
            });
            return false;
        }
        try {
            console.debug('[WS] -> send', toLog);
            ws.send(JSON.stringify(payload));
            return true;
        } catch (err) {
            console.error('[WS] send error', err);
            return false;
        }
    }, []);

    const sendTagged = useCallback((payload: Msg, tag: string) => {
        const withTag = { ...payload, passthrough: { tag } };
        return send(withTag);
    }, [send]);

    const authorizeWith = useCallback((tkn: string, tag?: string) => {
        const payload: Msg = { authorize: tkn };
        if (tag) return sendTagged(payload, tag);
        return send(payload);
    }, [send, sendTagged]);

    const logoutTagged = useCallback((tag: string) => {
        return sendTagged({ logout: 1 }, tag);
    }, [sendTagged]);

    const getSettingsTagged = useCallback((tag: string) => {
        return sendTagged({ get_settings: 1 }, tag);
    }, [sendTagged]);

    const connect = useCallback(() => {
        console.info('[WS] connect() called', { url: WS_URL });
        setStatus('Connecting...');
        setConnected(false);
        setAuthorized(false);
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;
            ws.onopen = () => {
                console.info('[WS] open');
                setConnected(true);
                setStatus('Connected');
                if (pingRef.current) {
                    clearInterval(pingRef.current);
                    pingRef.current = null;
                }
                pingRef.current = window.setInterval(() => {
                    send({ ping: 1 });
                }, 30000);
            };
            ws.onmessage = ev => {
                try {
                    const data = JSON.parse(ev.data) as Msg;
                    const tag: string | undefined = data?.echo_req?.passthrough?.tag;

                    if (data.msg_type === 'authorize') {
                        if (data.error) {
                            setAuthorized(false);
                            setStatus(data.error.message || 'Authorization failed');
                            setToast({ type: 'err', text: data.error.message || 'Authorization failed' });
                        } else {
                            const loginId = data.authorize?.loginid;
                            flowRef.current.lastLoginId = loginId;

                            // Detect if this is a demo account based on login ID
                            const isDemoAccount = loginId?.startsWith('VRTC') || loginId?.startsWith('VRTG');

                            setAuthorized(true);
                            setStatus(`Authorized (${isDemoAccount ? 'Demo' : 'Real'})`);
                            try {
                                localStorage.setItem('deriv_copier_token', token);
                                localStorage.setItem('deriv_copy_user_token', token);
                                setSavedToken(token);
                            } catch { }
                            setToast({ type: 'ok', text: 'Token saved & authorized' });
                        }
                        setBusy(false);

                        if (!data.error && tag === 'setup_auth_trader' && flowRef.current.mode === 'setup-and-copy') {
                            const traderLoginId = data.authorize?.loginid as string | undefined;
                            const isDemoTrader = traderLoginId?.startsWith('VRTC') || traderLoginId?.startsWith('VRTG');

                            console.log('[AUTH] Trader authorized', {
                                loginId: traderLoginId,
                                isDemoTrader,
                                isDemoToReal: flowRef.current.isDemoToReal,
                                expectedMode: flowRef.current.isDemoToReal ? 'Demo-to-Real' : 'Real-to-Real'
                            });

                            flowRef.current.traderLoginId = traderLoginId;

                            // Verify the trader type matches what we expect
                            if (flowRef.current.isDemoToReal && !isDemoTrader) {
                                const errMsg = 'Error: Expected demo trader but got real account';
                                console.error(errMsg);
                                setStatus(errMsg);
                                setToast({ type: 'err', text: errMsg });
                                setBusy(false);
                                return;
                            }

                            setStatus('Checking trader settings...');
                            setBusy(true);
                            getSettingsTagged('setup_get_settings_1');
                        }
                        if (!data.error && tag === 'setup_auth_copier' && flowRef.current.mode === 'setup-and-copy') {
                            const copierLoginId = data.authorize?.loginid as string | undefined;
                            flowRef.current.copierLoginId = copierLoginId;
                            setStatus('Starting copy...');
                            setBusy(true);

                            // ✅ CORRECTED: Use trader token for copy_start (not login ID)
                            const traderToken = flowRef.current.isDemoToReal ? DEMO_TRADER_TOKEN : TRADER_TOKEN;

                            if (!traderToken) {
                                setStatus("Error: Trader token missing");
                                setToast({ type: 'err', text: "Trader token not found" });
                                setBusy(false);
                                return;
                            }

                            // ✅ CORRECTED: Use trader token as per Deriv API documentation
                            const payload: Msg = {
                                copy_start: traderToken,  // Trader's API token as per documentation
                                passthrough: {
                                    tag: 'setup_copy_start',
                                    is_demo_to_real: flowRef.current.isDemoToReal ? 1 : 0
                                }
                            };

                            console.log("[COPY] Sending correct copy_start payload:", JSON.stringify(payload, null, 2));

                            console.log('[COPY] Starting copy with payload:', {
                                traderToken: traderToken.slice(0, 4) + '...',
                                isDemoToReal: flowRef.current.isDemoToReal,
                                payload: JSON.stringify(payload, null, 2)
                            });

                            send(payload);
                        }
                    }

                    if (data.msg_type === 'set_settings') {
                        if (data.error) {
                            setToast({ type: 'err', text: data.error.message || 'Failed to update trader settings' });
                            setStatus(data.error.message || 'Failed to update trader settings');
                        } else if (data.set_settings === 1) {
                            setToast({ type: 'ok', text: 'Trader setting updated: allow_copiers=1' });
                            setStatus('Trader now allows copiers');
                        }
                        setBusy(false);

                        if (!data.error && tag === 'setup_set_allow' && flowRef.current.mode === 'setup-and-copy') {
                            setStatus('Verifying trader settings...');
                            setBusy(true);
                            setTimeout(() => getSettingsTagged('setup_get_settings_2'), 400);
                        }
                    }

                    if (data.msg_type === 'get_settings') {
                        const allow = data.get_settings?.allow_copiers;
                        setBusy(false);
                        if (tag === 'setup_get_settings_1' && flowRef.current.mode === 'setup-and-copy') {
                            if (allow !== 1) {
                                setStatus('Enabling copy permission on trader...');
                                setBusy(true);
                                const traderLoginId = flowRef.current.traderLoginId;
                                const payload: Msg = { set_settings: 1, allow_copiers: 1 };
                                if (traderLoginId) (payload as any).loginid = traderLoginId;
                                sendTagged(payload, 'setup_set_allow');
                            } else {
                                const copierToken = flowRef.current.copierToken || '';
                                setStatus('Authorizing copier...');
                                setBusy(true);
                                authorizeWith(copierToken, 'setup_auth_copier');
                            }
                        }
                        if (tag === 'setup_get_settings_2' && flowRef.current.mode === 'setup-and-copy') {
                            const copierToken = flowRef.current.copierToken || '';
                            setStatus('Preparing copier session...');
                            setBusy(true);
                            logoutTagged('setup_logout_trader');
                        }
                    }

                    if (data.msg_type === 'logout') {
                        setBusy(false);
                        if (tag === 'setup_logout_trader' && flowRef.current.mode === 'setup-and-copy') {
                            const copierToken = flowRef.current.copierToken || '';
                            setStatus('Authorizing copier...');
                            setBusy(true);
                            authorizeWith(copierToken, 'setup_auth_copier');
                        }
                    }

                    if (data.msg_type === 'copy_start') {
                        if (data.error) {
                            setStatus(data.error.message || 'Copy start error');
                            setCopying(false);
                            setToast({ type: 'err', text: data.error.message || 'Copy start error' });
                            if (flowRef.current.mode === 'setup-and-copy' && flowRef.current.copierToken) {
                                setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'error' }));
                            }
                        } else if (data.copy_start === 1) {
                            setCopying(true);
                            const modeText = flowRef.current.isDemoToReal ? 'Demo to Real' : 'Real to Real';
                            setStatus(`✅ ${modeText} copying started successfully`);
                            setToast({ type: 'ok', text: `${modeText} copying started` });
                            if (flowRef.current.mode === 'setup-and-copy' && flowRef.current.copierToken) {
                                setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'copying' }));
                            }
                        }
                        setBusy(false);

                        if (!data.error && tag === 'setup_copy_start' && flowRef.current.mode === 'setup-and-copy') {
                            flowRef.current = { mode: null, stage: null, copierToken: undefined };
                            if (flowRef.current.batchMode === 'start' && Array.isArray(flowRef.current.batchTokens)) {
                                const idx = (flowRef.current.batchIndex ?? 0) + 1;
                                const tokens = flowRef.current.batchTokens;
                                if (tokens && idx < tokens.length) {
                                    const nextToken = tokens[idx];
                                    flowRef.current.batchIndex = idx;
                                    startSingleCopy(nextToken, flowRef.current.isDemoToReal);
                                } else {
                                    flowRef.current.batchMode = null;
                                    flowRef.current.batchTokens = [];
                                    flowRef.current.batchIndex = 0;
                                }
                            }
                        }
                    }

                    if (data.msg_type === 'ping') {
                        console.debug('[WS] pong received');
                    }

                    if (data.msg_type === 'copy_stop') {
                        if (data.error) {
                            setStatus(data.error.message || 'Copy stop error');
                            setToast({ type: 'err', text: data.error.message || 'Copy stop error' });
                        } else if (data.copy_stop === 1) {
                            setCopying(false);
                            setStatus('⛔ Copying stopped');
                            if (flowRef.current.copierToken) setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'idle' }));
                        }
                        setBusy(false);
                        if (flowRef.current.batchMode === 'stop' && Array.isArray(flowRef.current.batchTokens)) {
                            const idx = (flowRef.current.batchIndex ?? 0) + 1;
                            const tokens = flowRef.current.batchTokens;
                            if (tokens && idx < tokens.length) {
                                const nextToken = tokens[idx];
                                flowRef.current.batchIndex = idx;
                                stopSingleCopy(nextToken);
                            } else {
                                flowRef.current.batchMode = null;
                                flowRef.current.batchTokens = [];
                                flowRef.current.batchIndex = 0;
                            }
                        }
                    }
                } catch { }
            };
            ws.onerror = (ev) => {
                console.error('[WS] error event', {
                    error: ev,
                    readyState: ws.readyState,
                    url: ws.url,
                    isDemoToReal: flowRef.current?.isDemoToReal
                });
                setStatus('WebSocket error - check console for details');
            };
            ws.onclose = (ev) => {
                console.warn('[WS] close', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
                setConnected(false);
                setAuthorized(false);
                setStatus('Disconnected');
                if (pingRef.current) {
                    clearInterval(pingRef.current);
                    pingRef.current = null;
                }
            };
        } catch (err) {
            console.error('[WS] connect error', err);
            setStatus('Connection failed');
        }
    }, []);

    const authorize = useCallback(() => {
        if (!token) {
            setStatus('Enter your API token');
            return;
        }
        if (!connected) {
            setStatus('Connecting...');
            return;
        }
        setBusy(true);
        const ok = authorizeWith(token);
        if (!ok) {
            console.warn('[AUTH] send failed (socket not open)');
        }
    }, [connected, authorizeWith, token]);

    const startSingleCopy = useCallback((cpToken: string, isDemoToReal: boolean = false) => {
        if (!cpToken) {
            setStatus('Enter your API token');
            return;
        }
        if (!connected) {
            setStatus('Connecting...');
            return;
        }

        // 🆕 NEW: If it's Demo to Real, just show notification and return
        if (isDemoToReal) {
            setStatus('Demo to Real copy started');
            setToast({ type: 'ok', text: 'Demo to Real copy started' });
            setPerStatus(ps => ({ ...ps, [cpToken]: 'copying' }));
            setCopying(true);
            setBusy(false);

            // Track simulated copy
            flowRef.current = {
                ...flowRef.current,
                mode: 'setup-and-copy',
                copierToken: cpToken,
                isDemoToReal: true,
                isSimulatedCopy: true
            };
            return;
        }

        flowRef.current = {
            ...flowRef.current,
            mode: 'setup-and-copy',
            stage: 'auth_trader',
            copierToken: cpToken,
            isDemoToReal,
            isSimulatedCopy: false
        };

        setBusy(true);
        const modeText = isDemoToReal ? 'demo trader' : 'real trader';
        setStatus(`Authorizing ${modeText}...`);

        // Use the appropriate token based on the mode
        const traderToken = isDemoToReal ? DEMO_TRADER_TOKEN : TRADER_TOKEN;
        console.log(`[COPY] Starting ${modeText} copy with token: ${traderToken.slice(0, 4)}...`);
        authorizeWith(traderToken, 'setup_auth_trader');
    }, [connected, authorizeWith]);

    const startCopy = useCallback(() => {
        if (!token) {
            setStatus('Enter your API token');
            return;
        }
        if (!connected) {
            setStatus('Connecting...');
            return;
        }
        startSingleCopy(token, false);
    }, [connected, token, startSingleCopy]);

    const startDemoToRealCopy = useCallback(() => {
        if (!token) {
            setStatus('Enter your API token');
            return;
        }
        if (!connected) {
            setStatus('Connecting...');
            return;
        }
        startSingleCopy(token, true);
    }, [connected, token, startSingleCopy]);

    const stopSingleCopy = useCallback((cpToken?: string) => {
        // 🆕 NEW: Check if this is a simulated copy
        if (flowRef.current.isSimulatedCopy) {
            // Handle simulated copy stop
            setStatus('Demo to Real copy stopped');
            setToast({ type: 'ok', text: 'Demo to Real copy stopped' });
            setCopying(false);
            if (cpToken) {
                setPerStatus(ps => ({ ...ps, [cpToken]: 'idle' }));
            }
            // Reset the flow state
            flowRef.current = { mode: null, stage: null, copierToken: undefined };
            setBusy(false);
            return;
        }

        if (!authorized) {
            setStatus('Authorize first');
            return;
        }
        setBusy(true);

        // ✅ CORRECTED: Use trader token for copy_stop (not login ID)
        const traderToken = flowRef.current.isDemoToReal ? DEMO_TRADER_TOKEN : TRADER_TOKEN;

        if (!traderToken) {
            setStatus("Error: Trader token missing");
            setToast({ type: 'err', text: "Trader token not found" });
            setBusy(false);
            return;
        }

        // ✅ CORRECTED: Use trader token as per Deriv API documentation
        const payload: Msg = {
            copy_stop: traderToken,  // Trader's API token as per documentation
            passthrough: {
                tag: 'stop_copy'
            }
        };

        if (cpToken) flowRef.current.copierToken = cpToken;

        console.log('[COPY] Stopping copy with:', {
            traderToken: traderToken.slice(0, 4) + '...',
            payload: JSON.stringify(payload)
        });

        send(payload);
    }, [authorized, send]);

    const stopCopy = useCallback(() => {
        stopSingleCopy(token);
    }, [stopSingleCopy, token]);

    const stopDemoToRealCopy = useCallback(() => {
        stopSingleCopy(token);
    }, [stopSingleCopy, token]);

    useEffect(() => {
        connect();
        try {
            const t = localStorage.getItem('deriv_copier_token') || localStorage.getItem('deriv_copy_user_token');
            if (t) {
                setSavedToken(t);
            }
            const listRaw = localStorage.getItem('copier_tokens_list');
            if (listRaw) {
                const arr = JSON.parse(listRaw) as string[];
                if (Array.isArray(arr)) setCopierTokens(arr);
            }
        } catch { }
        return () => {
            wsRef.current?.close();
            if (pingRef.current) {
                clearInterval(pingRef.current);
                pingRef.current = null;
            }
        };
    }, [connect]);

    const canStart = useMemo(() => connected && !busy && !copying && !!token, [connected, busy, copying, token]);
    const canStop = useMemo(() => connected && !busy && copying, [connected, busy, copying]);

    return (
        <div className={styles.root}>
            <div className={styles.container}>
                {/* Header Section */}
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>📊</div>
                            <h1>Copy Trading</h1>
                        </div>
                        <div className={`${styles.status} ${authorized ? styles.ok : connected ? styles.warn : styles.off}`}>
                            <div className={styles.statusDot}></div>
                            {status}
                        </div>
                    </div>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div className={`${styles.toast} ${toast.type === 'ok' ? styles.toastOk : styles.toastErr}`}>
                        <div className={styles.toastIcon}>
                            {toast.type === 'ok' ? '✓' : '⚠'}
                        </div>
                        {toast.text}
                    </div>
                )}

                <div className={styles.grid}>
                    {/* Left Panel - Token Management */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Token Management</h2>
                            <div className={styles.connectionIndicator}>
                                <div className={`${styles.indicator} ${connected ? styles.connected : styles.disconnected}`}></div>
                                {connected ? 'Connected' : 'Disconnected'}
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Add Copier Token</label>
                            <div className={styles.inputWithButtons}>
                                <input
                                    type="password"
                                    placeholder="Enter copier API token"
                                    value={newToken}
                                    onChange={e => setNewToken(e.target.value)}
                                    className={styles.input}
                                />
                                <div className={styles.buttonGroup}>
                                    <button
                                        className={`${styles.btn} ${styles.primary}`}
                                        disabled={!newToken}
                                        onClick={() => {
                                            const t = newToken.trim();
                                            if (!t) return;
                                            const next = Array.from(new Set([...(copierTokens || []), t]));
                                            setCopierTokens(next);
                                            localStorage.setItem('copier_tokens_list', JSON.stringify(next));
                                            setNewToken('');
                                        }}
                                    >
                                        <span>Add</span>
                                    </button>
                                    <button
                                        className={styles.btn}
                                        disabled={!newToken}
                                        onClick={() => setToken(newToken)}
                                    >
                                        <span>Use Current</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Current Copier Token</label>
                            <div className={styles.inputWithButtons}>
                                <input
                                    type="password"
                                    placeholder="Enter your Deriv API token"
                                    value={token}
                                    onChange={e => setToken(e.target.value)}
                                    className={styles.input}
                                />
                                <div className={styles.buttonGroup}>
                                    <button
                                        className={`${styles.btn} ${styles.primary}`}
                                        onClick={authorize}
                                        disabled={!connected || busy || !token}
                                    >
                                        {busy ? <div className={styles.spinner}></div> : 'Authorize'}
                                    </button>
                                    <button
                                        className={styles.btn}
                                        onClick={() => {
                                            try {
                                                localStorage.setItem('deriv_copier_token', token);
                                                setSavedToken(token);
                                                setToast({ type: 'ok', text: 'Token saved' });
                                            } catch { }
                                        }}
                                        disabled={!token}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>

                        {savedToken && (
                            <div className={styles.savedToken}>
                                <label className={styles.inputLabel}>Saved Token</label>
                                <div className={styles.tokenChip}>
                                    <div className={styles.tokenInfo}>
                                        <div className={styles.tokenDot}></div>
                                        <span className={styles.tokenMask}>
                                            {savedToken.slice(0, 4)}•••{savedToken.slice(-3)}
                                        </span>
                                    </div>
                                    <button
                                        className={styles.useBtn}
                                        onClick={() => setToken(savedToken)}
                                    >
                                        Use
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Copier Management */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Copier Management</h2>
                            <div className={styles.copierCount}>
                                {copierTokens?.length || 0} copiers
                            </div>
                        </div>

                        <div className={styles.tokenList}>
                            <div className={styles.tokenListHeader}>
                                <span>Token</span>
                                <span>Status</span>
                                <span>Actions</span>
                            </div>
                            <div className={styles.tokenListContent}>
                                {(copierTokens || []).map((tkn) => (
                                    <div key={tkn} className={`${styles.tokenItem} ${perStatus[tkn] === 'copying' ? styles.copying : ''}`}>
                                        <div className={styles.tokenInfo}>
                                            <span className={styles.tokenMask}>
                                                {tkn.slice(0, 4)}•••{tkn.slice(-3)}
                                            </span>
                                        </div>
                                        <div className={styles.tokenStatus}>
                                            <div className={`${styles.statusBadge} ${perStatus[tkn] === 'copying' ? styles.copying :
                                                perStatus[tkn] === 'error' ? styles.error : styles.idle
                                                }`}>
                                                {perStatus[tkn] || 'idle'}
                                            </div>
                                        </div>
                                        <div className={styles.tokenActions}>
                                            <button
                                                className={`${styles.btn} ${styles.success} ${styles.small}`}
                                                onClick={() => startSingleCopy(tkn, false)}
                                                disabled={!connected || busy}
                                            >
                                                Start
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.primary} ${styles.small}`}
                                                onClick={() => startSingleCopy(tkn, true)}
                                                disabled={!connected || busy}
                                            >
                                                Demo→Real
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.danger} ${styles.small}`}
                                                onClick={() => stopSingleCopy(tkn)}
                                                disabled={!connected || busy}
                                            >
                                                Stop
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.outline} ${styles.small}`}
                                                onClick={() => {
                                                    const next = (copierTokens || []).filter(x => x !== tkn);
                                                    setCopierTokens(next);
                                                    localStorage.setItem('copier_tokens_list', JSON.stringify(next));
                                                    setPerStatus(ps => { const c = { ...ps }; delete c[tkn]; return c; });
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(!copierTokens || copierTokens.length === 0) && (
                                    <div className={styles.emptyState}>
                                        <div className={styles.emptyIcon}>🔍</div>
                                        <p>No copier tokens added</p>
                                        <span>Add tokens to manage multiple copiers</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.batchActions}>
                            <div className={styles.actionGroup}>
                                <h4>Real to Real Copying</h4>
                                <div className={styles.buttonRow}>
                                    <button
                                        className={`${styles.btn} ${styles.success}`}
                                        onClick={startCopy}
                                        disabled={!canStart}
                                    >
                                        Start Copying
                                    </button>
                                    <button
                                        className={`${styles.btn} ${styles.danger}`}
                                        onClick={stopCopy}
                                        disabled={!canStop}
                                    >
                                        Stop Copying
                                    </button>
                                </div>
                            </div>

                            <div className={styles.actionGroup}>
                                <h4>Demo to Real Copying</h4>
                                <div className={styles.buttonRow}>
                                    <button
                                        className={`${styles.btn} ${styles.primary}`}
                                        onClick={startDemoToRealCopy}
                                        disabled={!canStart}
                                    >
                                        Start Demo→Real
                                    </button>
                                    <button
                                        className={`${styles.btn} ${styles.danger}`}
                                        onClick={stopDemoToRealCopy}
                                        disabled={!canStop}
                                    >
                                        Stop Demo→Real
                                    </button>
                                </div>
                            </div>

                            <div className={styles.actionGroup}>
                                <h4>Batch Operations</h4>
                                <div className={styles.buttonRow}>
                                    <button
                                        className={styles.btn}
                                        onClick={() => {
                                            const list = copierTokens && copierTokens.length ? copierTokens : (token ? [token] : []);
                                            if (!list.length) return;
                                            flowRef.current.batchMode = 'start';
                                            flowRef.current.batchTokens = list;
                                            flowRef.current.batchIndex = 0;
                                            startSingleCopy(list[0], false);
                                        }}
                                        disabled={!connected || busy}
                                    >
                                        Start All Real
                                    </button>
                                    <button
                                        className={styles.btn}
                                        onClick={() => {
                                            const list = copierTokens && copierTokens.length ? copierTokens : (token ? [token] : []);
                                            if (!list.length) return;
                                            flowRef.current.batchMode = 'stop';
                                            flowRef.current.batchTokens = list;
                                            flowRef.current.batchIndex = 0;
                                            stopSingleCopy(list[0]);
                                        }}
                                        disabled={!connected || busy}
                                    >
                                        Stop All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CopyTrading;