import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CopyTradingPage.module.scss';

type DerivMessage = Record<string, any>;

const APP_ID = 107711; // from config
const WS_URL = `wss://ws.deriv.com/websockets/v3?app_id=${APP_ID}`;

const STORAGE_KEYS = {
    user_loginid: 'deriv_copy_user_loginid',
    user_token: 'deriv_copy_user_token',
    trader_token: 'deriv_copy_trader_token',
};

const CopyTradingPage: React.FC = () => {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const [loginid, setLoginid] = useState<string>(localStorage.getItem(STORAGE_KEYS.user_loginid) || '');
    const [token, setToken] = useState<string>(localStorage.getItem(STORAGE_KEYS.user_token) || '');
    const [traderToken, setTraderToken] = useState<string>(localStorage.getItem(STORAGE_KEYS.trader_token) || '');

    const [balance, setBalance] = useState<number | null>(null);
    const [currency, setCurrency] = useState<string>('');
    const [copyStatus, setCopyStatus] = useState<string>('Idle');

    const [messages, setMessages] = useState<string[]>([]);

    const addMsg = useCallback((m: string) => setMessages(prev => [`${new Date().toLocaleTimeString()} ${m}`, ...prev].slice(0, 200)), []);

    const safeSend = useCallback((payload: DerivMessage) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(payload));
        addMsg(`➡️ ${JSON.stringify(payload)}`);
        return true;
    }, [addMsg]);

    const connect = useCallback(() => {
        setConnectionError(null);
        setIsConnected(false);
        setIsAuthorized(false);
        setCopyStatus('Idle');

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                addMsg('✅ WebSocket connected');
                if (token) {
                    authorize(token);
                }
            };

            ws.onmessage = ev => {
                try {
                    const data = JSON.parse(ev.data) as DerivMessage;
                    addMsg(`⬅️ ${ev.data}`);

                    if (data.msg_type === 'authorize') {
                        if (data.error) {
                            setIsAuthorized(false);
                            setConnectionError(data.error.message || 'Authorization failed');
                            return;
                        }
                        setIsAuthorized(true);
                        const auth_loginid = data.authorize?.loginid as string | undefined;
                        if (auth_loginid && !loginid) setLoginid(auth_loginid);
                        subscribeBalance();
                    }

                    if (data.msg_type === 'balance') {
                        if (data.error) return;
                        const bal = data.balance?.balance as number | undefined;
                        const curr = data.balance?.currency as string | undefined;
                        if (typeof bal === 'number') setBalance(bal);
                        if (curr) setCurrency(curr);
                    }

                    if (data.msg_type === 'copy_start') {
                        if (data.error) {
                            setCopyStatus(`Copy start error: ${data.error.message}`);
                        } else if (data.copy_start === 1) {
                            setCopyStatus('Copying started');
                        }
                    }

                    if (data.msg_type === 'copy_stop') {
                        if (data.error) {
                            setCopyStatus(`Copy stop error: ${data.error.message}`);
                        } else if (data.copy_stop === 1) {
                            setCopyStatus('Copying stopped');
                        }
                    }
                } catch (e) {
                    // noop
                }
            };

            ws.onerror = () => {
                setConnectionError('WebSocket error');
            };

            ws.onclose = () => {
                setIsConnected(false);
                setIsAuthorized(false);
                addMsg('❌ WebSocket closed');
            };
        } catch (e: any) {
            setConnectionError(e?.message || 'Failed to connect');
        }
    }, [token, loginid, addMsg]);

    const disconnect = useCallback(() => {
        wsRef.current?.close();
        wsRef.current = null;
    }, []);

    const authorize = useCallback((tok: string) => {
        safeSend({ authorize: tok });
    }, [safeSend]);

    const subscribeBalance = useCallback(() => {
        safeSend({ balance: 1, subscribe: 1 });
    }, [safeSend]);

    const startCopy = useCallback(() => {
        if (!traderToken) {
            setCopyStatus('Please provide trader API token');
            return;
        }
        const payload: DerivMessage = {
            copy_start: traderToken,
        };
        if (loginid) payload.loginid = loginid;
        safeSend(payload);
    }, [safeSend, traderToken, loginid]);

    const stopCopy = useCallback(() => {
        safeSend({ copy_stop: 1 });
    }, [safeSend]);

    const saveCreds = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.user_loginid, loginid);
        localStorage.setItem(STORAGE_KEYS.user_token, token);
        addMsg('💾 Saved user loginid/token');
    }, [loginid, token, addMsg]);

    const saveTrader = useCallback(() => {
        localStorage.setItem(STORAGE_KEYS.trader_token, traderToken);
        addMsg('💾 Saved trader token');
    }, [traderToken, addMsg]);

    useEffect(() => {
        connect();
        return () => disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connLabel = useMemo(() => {
        if (!isConnected) return 'Disconnected';
        if (isConnected && !isAuthorized) return 'Connected - Not authorized';
        return 'Connected & Authorized';
    }, [isConnected, isAuthorized]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2>Copy Trading</h2>
                <div className={styles.statusRow}>
                    <span className={`${styles.dot} ${isConnected ? styles.ok : styles.bad}`}></span>
                    <span className={styles.statusText}>{connLabel}</span>
                    {connectionError && <span className={styles.error}>• {connectionError}</span>}
                </div>
            </div>

            <div className={styles.grid}>
                <section className={styles.card}>
                    <h3>Your Account</h3>
                    <div className={styles.formRow}>
                        <label>Login ID</label>
                        <input value={loginid} onChange={e => setLoginid(e.target.value)} placeholder="CRxxxxxx / VRxxxxxx" />
                    </div>
                    <div className={styles.formRow}>
                        <label>API Token</label>
                        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your Deriv API token" />
                    </div>
                    <div className={styles.actions}>
                        <button onClick={saveCreds}>Save</button>
                        <button onClick={() => authorize(token)} disabled={!isConnected || !token}>Authorize</button>
                        <button onClick={connect}>Reconnect</button>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Balance</span>
                        <span className={styles.value}>{balance !== null ? `${balance.toFixed(2)} ${currency}` : '-'}</span>
                    </div>
                </section>

                <section className={styles.card}>
                    <h3>Trader Token</h3>
                    <div className={styles.formRow}>
                        <label>Trader's Read-only API Token</label>
                        <input value={traderToken} onChange={e => setTraderToken(e.target.value)} placeholder="Token to copy from" />
                    </div>
                    <div className={styles.actions}>
                        <button onClick={saveTrader}>Save</button>
                        <button onClick={startCopy} disabled={!isAuthorized || !traderToken}>Start Copy Trading</button>
                        <button onClick={stopCopy} disabled={!isAuthorized}>Stop</button>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Status</span>
                        <span className={styles.value}>{copyStatus}</span>
                    </div>
                </section>

                <section className={`${styles.card} ${styles.logCard}`}>
                    <h3>Activity</h3>
                    <div className={styles.logBox}>
                        {messages.map((m, i) => (
                            <div key={i} className={styles.logLine}>{m}</div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default CopyTradingPage;