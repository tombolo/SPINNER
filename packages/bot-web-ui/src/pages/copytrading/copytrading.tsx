'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CopyTradingPage.module.scss';

type Msg = Record<string, any>;

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=70344';
const TRADER_TOKEN = 'aRfMuZydUaYs9U6';

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
                // Start keep-alive ping every 30s
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
                    console.debug('[WS] <- message raw', ev.data);
                    const data = JSON.parse(ev.data) as Msg;
                    console.debug('[WS] <- message parsed', data);
                    const tag: string | undefined = data?.echo_req?.passthrough?.tag;
                    if (data.msg_type === 'authorize') {
                        if (data.error) {
                            console.warn('[AUTH] authorize error', { code: data.error.code, message: data.error.message });
                            setAuthorized(false);
                            setStatus(data.error.message || 'Authorization failed');
                            setToast({ type: 'err', text: data.error.message || 'Authorization failed' });
                        } else {
                            console.info('[AUTH] authorized ok', { loginid: data.authorize?.loginid, scopes: data.authorize?.scopes });
                            flowRef.current.lastLoginId = data.authorize?.loginid;
                            setAuthorized(true);
                            setStatus('Authorized');
                            try {
                                localStorage.setItem('deriv_copier_token', token);
                                localStorage.setItem('deriv_copy_user_token', token);
                                setSavedToken(token);
                            } catch {}
                            setToast({ type: 'ok', text: 'Token saved & authorized' });
                        }
                        setBusy(false);

                        // Flow control for setup-and-copy
                        if (!data.error && tag === 'setup_auth_trader' && flowRef.current.mode === 'setup-and-copy') {
                            const traderLoginId = data.authorize?.loginid as string | undefined;
                            flowRef.current.traderLoginId = traderLoginId;
                            console.info('[FLOW] Trader authorized, checking settings', { traderLoginId });
                            setStatus('Checking trader settings...');
                            setBusy(true);
                            getSettingsTagged('setup_get_settings_1');
                        }
                        if (!data.error && tag === 'setup_auth_copier' && flowRef.current.mode === 'setup-and-copy') {
                            const copierLoginId = data.authorize?.loginid as string | undefined;
                            flowRef.current.copierLoginId = copierLoginId;
                            console.info('[FLOW] Copier authorized, sending copy_start', { copierLoginId });
                            setStatus('Starting copy...');
                            setBusy(true);
                            const payload: Msg = { copy_start: TRADER_TOKEN };
                            if (copierLoginId) (payload as any).loginid = copierLoginId;
                            sendTagged(payload, 'setup_copy_start');
                        }
                    }
                    if (data.msg_type === 'set_settings') {
                        if (data.error) {
                            console.warn('[SETTINGS] set_settings error', { code: data.error.code, message: data.error.message, error: data.error });
                            setToast({ type: 'err', text: data.error.message || 'Failed to update trader settings' });
                            setStatus(data.error.message || 'Failed to update trader settings');
                        } else if (data.set_settings === 1) {
                            console.info('[SETTINGS] allow_copiers enabled successfully');
                            setToast({ type: 'ok', text: 'Trader setting updated: allow_copiers=1' });
                            setStatus('Trader now allows copiers');
                        }
                        setBusy(false);

                        if (!data.error && tag === 'setup_set_allow' && flowRef.current.mode === 'setup-and-copy') {
                            // Recheck settings to confirm allow_copiers is applied
                            console.info('[FLOW] Re-checking trader settings after update');
                            setStatus('Verifying trader settings...');
                            setBusy(true);
                            setTimeout(() => getSettingsTagged('setup_get_settings_2'), 400);
                        }
                    }
                    if (data.msg_type === 'get_settings') {
                        const allow = data.get_settings?.allow_copiers;
                        console.info('[SETTINGS] get_settings', { allow_copiers: allow, full: data.get_settings });
                        setBusy(false);
                        if (tag === 'setup_get_settings_1' && flowRef.current.mode === 'setup-and-copy') {
                            if (allow !== 1) {
                                console.info('[FLOW] allow_copiers != 1, updating now');
                                setStatus('Enabling copy permission on trader...');
                                setBusy(true);
                                const traderLoginId = flowRef.current.traderLoginId;
                                const payload: Msg = { set_settings: 1, allow_copiers: 1 };
                                if (traderLoginId) (payload as any).loginid = traderLoginId;
                                sendTagged(payload, 'setup_set_allow');
                            } else {
                                // Already allowed; proceed
                                const copierToken = flowRef.current.copierToken || '';
                                console.info('[FLOW] allow_copiers already enabled, authorizing copier');
                                setStatus('Authorizing copier...');
                                setBusy(true);
                                authorizeWith(copierToken, 'setup_auth_copier');
                            }
                        }
                        if (tag === 'setup_get_settings_2' && flowRef.current.mode === 'setup-and-copy') {
                            const copierToken = flowRef.current.copierToken || '';
                            // To avoid multiple authorized tokens in one session, logout trader first, then auth copier.
                            console.info('[FLOW] Logging out trader session before authorizing copier');
                            setStatus('Preparing copier session...');
                            setBusy(true);
                            logoutTagged('setup_logout_trader');
                        }
                    }
                    if (data.msg_type === 'logout') {
                        console.info('[AUTH] logout result', data);
                        setBusy(false);
                        if (tag === 'setup_logout_trader' && flowRef.current.mode === 'setup-and-copy') {
                            const copierToken = flowRef.current.copierToken || '';
                            console.info('[FLOW] Trader logged out, authorizing copier now');
                            setStatus('Authorizing copier...');
                            setBusy(true);
                            authorizeWith(copierToken, 'setup_auth_copier');
                        }
                    }
                    if (data.msg_type === 'copy_start') {
                        if (data.error) {
                            console.warn('[COPY] start error', { code: data.error.code, message: data.error.message, error: data.error, full: data });
                            setStatus(data.error.message || 'Copy start error');
                            setCopying(false);
                            setToast({ type: 'err', text: data.error.message || 'Copy start error' });
                            if (flowRef.current.mode === 'setup-and-copy' && flowRef.current.copierToken) {
                                setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'error' }));
                            }
                        } else if (data.copy_start === 1) {
                            console.info('[COPY] started', { full: data });
                            setCopying(true);
                            setStatus('✅ Copying started successfully');
                            setToast({ type: 'ok', text: 'Copying started' });
                            if (flowRef.current.mode === 'setup-and-copy' && flowRef.current.copierToken) {
                                setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'copying' }));
                            }
                        }
                        setBusy(false);

                        if (!data.error && tag === 'setup_copy_start' && flowRef.current.mode === 'setup-and-copy') {
                            console.info('[FLOW] setup-and-copy completed');
                            flowRef.current = { mode: null, stage: null, copierToken: undefined };
                            // Continue batch start if active
                            if (flowRef.current.batchMode === 'start' && Array.isArray(flowRef.current.batchTokens)) {
                                const idx = (flowRef.current.batchIndex ?? 0) + 1;
                                const tokens = flowRef.current.batchTokens;
                                if (tokens && idx < tokens.length) {
                                    const nextToken = tokens[idx];
                                    console.info('[BATCH] proceeding to next copier', { idx, nextToken });
                                    flowRef.current.batchIndex = idx;
                                    // trigger single flow for next token
                                    startSingleCopy(nextToken);
                                } else {
                                    console.info('[BATCH] start complete');
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
                            console.warn('[COPY] stop error', { code: data.error.code, message: data.error.message });
                            setStatus(data.error.message || 'Copy stop error');
                            setToast({ type: 'err', text: data.error.message || 'Copy stop error' });
                        } else if (data.copy_stop === 1) {
                            console.info('[COPY] stopped');
                            setCopying(false);
                            setStatus('⛔ Copying stopped');
                            // Update per token if we have context
                            if (flowRef.current.copierToken) setPerStatus(ps => ({ ...ps, [flowRef.current.copierToken!]: 'idle' }));
                        }
                        setBusy(false);
                        // Continue batch stop if active
                        if (flowRef.current.batchMode === 'stop' && Array.isArray(flowRef.current.batchTokens)) {
                            const idx = (flowRef.current.batchIndex ?? 0) + 1;
                            const tokens = flowRef.current.batchTokens;
                            if (tokens && idx < tokens.length) {
                                const nextToken = tokens[idx];
                                console.info('[BATCH] proceeding to next stop', { idx, nextToken });
                                flowRef.current.batchIndex = idx;
                                stopSingleCopy(nextToken);
                            } else {
                                console.info('[BATCH] stop complete');
                                flowRef.current.batchMode = null;
                                flowRef.current.batchTokens = [];
                                flowRef.current.batchIndex = 0;
                            }
                        }
                    }
                } catch {}
            };
            ws.onerror = (ev) => {
                console.error('[WS] error event', ev);
                setStatus('WebSocket error');
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
        const masked = `${token.slice(0, 4)}…${token.slice(-3)}`;
        console.info('[AUTH] authorize() called', { connected, masked, length: token.length });
        setBusy(true);
        const ok = authorizeWith(token);
        if (!ok) {
            console.warn('[AUTH] send failed (socket not open)');
        }
    }, [connected, authorizeWith, token]);

    const startSingleCopy = useCallback((cpToken: string) => {
        if (!cpToken) {
            setStatus('Enter your API token');
            return;
        }
        if (!connected) {
            setStatus('Connecting...');
            return;
        }
        const maskedTrader = `${TRADER_TOKEN.slice(0, 4)}…${TRADER_TOKEN.slice(-3)}`;
        console.info('[FLOW] startSingleCopy(): begin setup-and-copy', { traderToken: maskedTrader });
        flowRef.current = { ...flowRef.current, mode: 'setup-and-copy', stage: 'auth_trader', copierToken: cpToken };
        setBusy(true);
        setStatus('Authorizing trader...');
        authorizeWith(TRADER_TOKEN, 'setup_auth_trader');
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
        startSingleCopy(token);
    }, [connected, token, startSingleCopy]);

    const enableAllowCopiers = useCallback(() => {
        if (!authorized) {
            setStatus('Authorize first as TRADER to change settings');
            setToast({ type: 'err', text: 'Authorize as TRADER account to update settings' });
            return;
        }
        console.info('[SETTINGS] enabling allow_copiers via set_settings');
        setBusy(true);
        send({ set_settings: 1, allow_copiers: 1 });
    }, [authorized, send]);

    const stopSingleCopy = useCallback((cpToken?: string) => {
        if (!authorized) {
            setStatus('Authorize first');
            return;
        }
        console.info('[COPY] stopCopy() called');
        setBusy(true);
        const payload: Msg = { copy_stop: TRADER_TOKEN };
        if (cpToken) flowRef.current.copierToken = cpToken;
        const loginid = flowRef.current.lastLoginId || flowRef.current.copierLoginId; // should be copier loginid
        if (loginid) (payload as any).loginid = loginid;
        const maskedTrader = `${TRADER_TOKEN.slice(0, 4)}…${TRADER_TOKEN.slice(-3)}`;
        console.debug('[COPY] -> stop payload', { copy_stop: maskedTrader, loginid });
        send(payload);
    }, [authorized, send]);

    const stopCopy = useCallback(() => {
        stopSingleCopy(token);
    }, [stopSingleCopy, token]);

    useEffect(() => {
        console.debug('[INIT] mounting, initiating connect');
        connect();
        try {
            const t = localStorage.getItem('deriv_copier_token') || localStorage.getItem('deriv_copy_user_token');
            if (t) {
                setSavedToken(t);
                console.debug('[INIT] found saved token', { masked: `${t.slice(0, 4)}…${t.slice(-3)}` });
            }
            const listRaw = localStorage.getItem('copier_tokens_list');
            if (listRaw) {
                const arr = JSON.parse(listRaw) as string[];
                if (Array.isArray(arr)) setCopierTokens(arr);
            }
        } catch {}
        return () => {
            console.debug('[CLEANUP] closing socket');
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
            <div className={styles.panel}>
                <div className={styles.section}>
                    <div className={styles.header}>
                        <div className={styles.title}>Copy Trading</div>
                        <div className={`${styles.status} ${authorized ? styles.ok : connected ? styles.warn : styles.off}`}>{status}</div>
                    </div>
                    {toast && (
                        <div className={`${styles.toast} ${toast.type === 'ok' ? styles.toastOk : styles.toastErr}`}>{toast.text}</div>
                    )}
                    <div className={styles.section}>
                        <div className={styles.label}>Add Copier Token</div>
                        <div className={styles.inputRow}>
                            <input className={styles.input} type="password" placeholder="Enter copier API token" value={newToken} onChange={e => setNewToken(e.target.value)} />
                            <div className={styles.inlineBtns}>
                                <button
                                    className={`${styles.btn} ${styles.primary}`}
                                    disabled={!newToken}
                                    onClick={() => {
                                        const t = newToken.trim();
                                        if (!t) return;
                                        const next = Array.from(new Set([...(copierTokens||[]), t]));
                                        setCopierTokens(next);
                                        localStorage.setItem('copier_tokens_list', JSON.stringify(next));
                                        setNewToken('');
                                    }}
                                >Add</button>
                                <button
                                    className={styles.btn}
                                    disabled={!newToken}
                                    onClick={() => setToken(newToken)}
                                >Use as current</button>
                            </div>
                        </div>
                    </div>
                    <div className={styles.tokensCard}>
                        <div className={styles.label}>Copier Tokens</div>
                        <div className={styles.tokenList}>
                            {(copierTokens||[]).map((tkn) => (
                                <div key={tkn} className={styles.tokenItem}>
                                    <div className={styles.tokenLeft}>
                                        <span className={`${styles.badge} ${perStatus[tkn] === 'copying' ? styles.copying : ''}`}>{perStatus[tkn] || 'idle'}</span>
                                        <span className={styles.mask}>{tkn.slice(0,4)}•••{tkn.slice(-3)}</span>
                                    </div>
                                    <div className={styles.inlineBtns}>
                                        <button className={`${styles.btn} ${styles.primary}`} onClick={() => startSingleCopy(tkn)} disabled={!connected || busy}>Start</button>
                                        <button className={`${styles.btn} ${styles.danger}`} onClick={() => stopSingleCopy(tkn)} disabled={!connected || busy}>Stop</button>
                                        <button className={styles.btn} onClick={() => {
                                            const next = (copierTokens||[]).filter(x => x !== tkn);
                                            setCopierTokens(next);
                                            localStorage.setItem('copier_tokens_list', JSON.stringify(next));
                                            setPerStatus(ps => { const c = { ...ps }; delete c[tkn]; return c; });
                                        }}>Remove</button>
                                    </div>
                                </div>
                            ))}
                            {(!copierTokens || copierTokens.length === 0) && (
                                <div className={styles.tokenItem}>
                                    <div className={styles.tokenLeft}>
                                        <span className={styles.badge}>empty</span>
                                        <span className={styles.mask}>Add tokens to manage multiple copiers</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.label}>Current Copier</div>
                    <div className={styles.inputRow}>
                        <input
                            type="password"
                            placeholder="Enter your Deriv API token"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            className={styles.input}
                        />
                        <div className={styles.inlineBtns}>
                            <button className={`${styles.btn} ${styles.primary}`} onClick={authorize} disabled={!connected || busy || !token}>Authorize</button>
                            <button
                                className={styles.btn}
                                onClick={() => { try { localStorage.setItem('deriv_copier_token', token); localStorage.setItem('deriv_copy_user_token', token); setSavedToken(token); setToast({ type: 'ok', text: 'Token saved' }); } catch {} }}
                                disabled={!token}
                            >Save</button>
                        </div>
                    </div>

                    <div className={styles.inputRow}>
                        <button className={`${styles.btn} ${styles.success}`} onClick={startCopy} disabled={!canStart}>Start Copying</button>
                        <button className={`${styles.btn} ${styles.danger}`} onClick={stopCopy} disabled={!canStop}>Stop Copying</button>
                        <button className={styles.btn} onClick={() => {
                            const list = copierTokens && copierTokens.length ? copierTokens : (token ? [token] : []);
                            if (!list.length) return;
                            flowRef.current.batchMode = 'start';
                            flowRef.current.batchTokens = list;
                            flowRef.current.batchIndex = 0;
                            startSingleCopy(list[0]);
                        }} disabled={!connected || busy}>Start All</button>
                        <button className={styles.btn} onClick={() => {
                            const list = copierTokens && copierTokens.length ? copierTokens : (token ? [token] : []);
                            if (!list.length) return;
                            flowRef.current.batchMode = 'stop';
                            flowRef.current.batchTokens = list;
                            flowRef.current.batchIndex = 0;
                            stopSingleCopy(list[0]);
                        }} disabled={!connected || busy}>Stop All</button>
                    </div>

                    {savedToken && (
                        <div className={styles.saved}>
                            <span className={styles.label}>Saved Token</span>
                            <button
                                className={styles.chip}
                                onClick={() => setToken(savedToken)}
                                title="Use saved token"
                            >
                                <span className={styles.dot}></span>
                                <span className={styles.mask}>{savedToken.slice(0, 4)}•••{savedToken.slice(-3)}</span>
                                <span className={styles.use}>Use</span>
                            </button>
                        </div>
                    )}
                    <div className={styles.footer}>
                        <button className={styles.btn} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Scroll Top</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CopyTrading;