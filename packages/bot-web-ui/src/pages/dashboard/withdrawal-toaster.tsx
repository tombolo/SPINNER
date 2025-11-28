import React from 'react';
import classNames from 'classnames';
import './withdrawal-toaster.scss';

const NAMES = [
    // Indian names
    'Aarav', 'Aanya', 'Arjun', 'Diya', 'Kabir', 'Kiara', 'Reyansh', 'Ananya', 'Vihaan', 'Ishaan',
    'Saanvi', 'Aditi', 'Aryan', 'Meera', 'Rahul', 'Priya', 'Vikram', 'Kavita', 'Rohan', 'Neha',
    
    // Tanzanian names
    'Juma', 'Amina', 'Rajabu', 'Zahara', 'Baraka', 'Fatuma', 'Hassan', 'Asha', 'Jabari', 'Neema',
    'Idris', 'Halima', 'Kato', 'Mariam', 'Omari', 'Zainab', 'Thabo', 'Aisha', 'Kwame', 'Nala',
    
    // Ghanaian names
    'Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Adwoa', 'Kwabena', 'Abena', 'Kwaku', 'Akua',
    'Yaa', 'Kweku', 'Afia', 'Yaw', 'Esi', 'Kwasi', 'Aba', 'Kwadwo', 'Akos', 'Kobina',
    
    // South African names
    'Lerato', 'Thando', 'Sipho', 'Nomsa', 'Tumi', 'Naledi', 'Kagiso', 'Puleng', 'Tebogo', 'Zanele',
    'Lungile', 'Nolwazi', 'Sibusiso', 'Thulisile', 'Mandla', 'Nomvula', 'Sizwe', 'Nokuthula', 'Vusi', 'Zinhle'
];

const STRATEGIES = [
    'Breakout Pro',
    'Mean Reversion',
    'Momentum Edge',
    'Grid Alpha',
    'Scalper X',
    'Trend Rider',
    'Volatility Vault',
    'Range Sniper',
];

const randomFloat = (min: number, max: number, decimals = 2) => {
    const v = Math.random() * (max - min) + min;
    return parseFloat(v.toFixed(decimals));
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const useInterval = (cb: () => void, ms: number) => {
    const saved = React.useRef(cb);
    React.useEffect(() => { saved.current = cb; }, [cb]);
    React.useEffect(() => {
        const id = setInterval(() => saved.current(), ms);
        return () => clearInterval(id);
    }, [ms]);
};

interface WithdrawalToasterProps {
    className?: string;
    variant?: 'success' | 'error';
}

const WithdrawalToaster: React.FC<WithdrawalToasterProps> = ({ className, variant = 'success' }) => {
    const [visible, setVisible] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [isExiting, setIsExiting] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout>();

    const trigger = React.useCallback(() => {
        const name = pick(NAMES);
        const amount = randomFloat(50, 2500, 2);
        const strategy = pick(STRATEGIES);
        const isError = Math.random() > 0.8; // 20% chance of error
        const action = isError ? 'failed to withdraw' : 'has withdrawn';
        const msg = `${name} ${action} $${amount.toLocaleString()} using ${strategy}.`;
        
        // Start exit animation
        if (visible) {
            setIsExiting(true);
            setTimeout(() => {
                setMessage(msg);
                setIsExiting(false);
                setVisible(true);
                // Reset exit state after animation completes
                setTimeout(() => setIsExiting(false), 300);
            }, 300);
        } else {
            setMessage(msg);
            setVisible(true);
        }

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                setVisible(false);
                setIsExiting(false);
            }, 300);
        }, 5000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [visible]);

    // First appear after mount, then at random intervals between 8-15s
    React.useEffect(() => {
        const timer = setTimeout(trigger, 3000);
        return () => clearTimeout(timer);
    }, [trigger]);

    useInterval(() => {
        const delay = Math.floor(Math.random() * 7000) + 8000; // 8-15s
        const timer = setTimeout(trigger, delay);
        return () => clearTimeout(timer);
    }, 15000);

    if (!visible) return null;

    const isError = message.includes('failed');
    const iconPath = isError 
        ? "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        : "M12 2L2 7l10 5 10-5-10-5zm0 7l-10 5 10 5 10-5-10-5z";

    return (
        <div 
            className={classNames(
                'db-withdrawal-toaster', 
                className, 
                { 
                    'db-withdrawal-toaster--visible': visible && !isExiting,
                    'db-withdrawal-toaster--exiting': isExiting
                }
            )} 
            role="status" 
            aria-live="polite"
        >
            <div 
                className={classNames(
                    'db-withdrawal-toaster__card', 
                    { 'error': isError }
                )} 
                aria-hidden
            >
                <div className='db-withdrawal-toaster__glow' aria-hidden />
                <div className='db-withdrawal-toaster__icon' aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d={iconPath} fillRule="evenodd" clipRule="evenodd"/>
                    </svg>
                </div>
                <div className='db-withdrawal-toaster__content'>
                    <div className='db-withdrawal-toaster__text'>{message}</div>
                    <div className='db-withdrawal-toaster__time'>
                        {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WithdrawalToaster;
