import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CopyTradingPage.module.scss';

type Msg = Record<string, any>;

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=70344';
const TRADER_TOKEN = 'Kkd5Ae5IHpFK40Q';

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

    const send = useCallback((payload: Msg) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(payload));
        return true;
    }, []);

    const connect = useCallback(() => {
        setStatus('Connecting...');
        setConnected(false);
        setAuthorized(false);
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;
            ws.onopen = () => {
                setConnected(true);
                setStatus('Connected');
            };
            ws.onmessage = ev => {
                try {
                    const data = JSON.parse(ev.data) as Msg;
                    if (data.msg_type === 'authorize') {
                        if (data.error) {
                            setAuthorized(false);
                            setStatus(data.error.message || 'Authorization failed');
                            setToast({ type: 'err', text: data.error.message || 'Authorization failed' });
                        } else {
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
                    }
                    if (data.msg_type === 'copy_start') {
                        if (data.error) {
                            setStatus(data.error.message || 'Copy start error');
                            setCopying(false);
                            setToast({ type: 'err', text: data.error.message || 'Copy start error' });
                        } else if (data.copy_start === 1) {
                            setCopying(true);
                            setStatus('✅ Copying started successfully');
                            setToast({ type: 'ok', text: 'Copying started' });
                        }
                        setBusy(false);
                    }
                    if (data.msg_type === 'copy_stop') {
                        if (data.error) {
                            setStatus(data.error.message || 'Copy stop error');
                            setToast({ type: 'err', text: data.error.message || 'Copy stop error' });
                        } else if (data.copy_stop === 1) {
                            setCopying(false);
                            setStatus('⛔ Copying stopped');
                            setToast({ type: 'ok', text: 'Copying stopped' });
                        }
                        setBusy(false);
                    }
                } catch {}
            };
            ws.onerror = () => {
                setStatus('WebSocket error');
            };
            ws.onclose = () => {
                setConnected(false);
                setAuthorized(false);
                setCopying(false);
                setStatus('Disconnected');
            };
        } catch {
            setStatus('Failed to connect');
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
        send({ authorize: token });
    }, [connected, send, token]);

    const startCopy = useCallback(() => {
        if (!authorized) {
            setStatus('Authorize first');
            return;
        }
        setBusy(true);
        send({ copy_start: TRADER_TOKEN });
    }, [authorized, send]);

    const stopCopy = useCallback(() => {
        if (!authorized) {
            setStatus('Authorize first');
            return;
        }
        setBusy(true);
        send({ copy_stop: 1 });
    }, [authorized, send]);

    useEffect(() => {
        connect();
        try {
            const t = localStorage.getItem('deriv_copier_token') || localStorage.getItem('deriv_copy_user_token');
            if (t) setSavedToken(t);
        } catch {}
        return () => wsRef.current?.close();
    }, [connect]);

    const canStart = useMemo(() => connected && authorized && !busy && !copying, [connected, authorized, busy, copying]);
    const canStop = useMemo(() => connected && authorized && !busy && copying, [connected, authorized, busy, copying]);

    return (
        <div className={styles.centerWrap}>
            <div className={styles.panel}>
                <div className={styles.title}>Copy Trading</div>
                <div className={styles.status} data-state={authorized ? 'ok' : connected ? 'connected' : 'off'}>
                    {status}
                </div>
                {toast && (
                    <div className={`${styles.toast} ${toast.type === 'ok' ? styles.toastOk : styles.toastErr}`}>
                        {toast.text}
                    </div>
                )}
                <div className={styles.inputRow}>
                    <input
                        type="password"
                        placeholder="Enter your Deriv API token"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                    />
                    <div className={styles.inlineBtns}>
                        <button className={styles.authBtn} onClick={authorize} disabled={!connected || busy || !token}>Authorize</button>
                        <button
                            className={styles.saveBtn}
                            onClick={() => { try { localStorage.setItem('deriv_copier_token', token); localStorage.setItem('deriv_copy_user_token', token); setSavedToken(token); setToast({ type: 'ok', text: 'Token saved' }); } catch {} }}
                            disabled={!token}
                        >Save</button>
                    </div>
                </div>
                <div className={styles.actions}>
                    <button className={styles.startBtn} onClick={startCopy} disabled={!canStart}>Start Copying</button>
                    <button className={styles.stopBtn} onClick={stopCopy} disabled={!canStop}>Stop Copying</button>
                </div>
                {savedToken && (
                    <div className={styles.savedSection}>
                        <div className={styles.savedTitle}>Saved Token</div>
                        <button
                            className={styles.tokenChip}
                            onClick={() => setToken(savedToken)}
                            title="Use saved token"
                        >
                            <span className={styles.dot}></span>
                            <span className={styles.mask}>{savedToken.slice(0, 4)}•••{savedToken.slice(-3)}</span>
                            <span className={styles.use}>Use</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CopyTrading;