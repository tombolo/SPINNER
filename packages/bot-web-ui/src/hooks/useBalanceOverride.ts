import { useEffect, useState } from 'react';
import { useStore } from 'Stores';

export const useBalanceOverride = () => {
    const { client } = useStore();
    const [balanceOffset, setBalanceOffset] = useState(0);
    const active_loginid = client.loginid;
    const is_special_demo = active_loginid === 'VRTC13340019';

    useEffect(() => {
        if (!is_special_demo) return;

        // Initial load of balance offset
        const loadBalanceOffset = () => {
            try {
                const offset = parseFloat(localStorage.getItem('demo_balance_offset') || '0');
                setBalanceOffset(offset);
            } catch (e) {
                console.warn('Error loading balance offset:', e);
            }
        };

        // Handle balance offset changes
        const handleBalanceOffsetChange = () => {
            loadBalanceOffset();
        };

        // Initial load
        loadBalanceOffset();

        // Listen for balance offset changes
        window.addEventListener('demo_balance_offset_changed', handleBalanceOffsetChange);

        // Cleanup
        return () => {
            window.removeEventListener('demo_balance_offset_changed', handleBalanceOffsetChange);
        };
    }, [is_special_demo]);

    // Return the overridden balance if it's the special demo account
    const getOverriddenBalance = () => {
        if (!is_special_demo) return client.balance;
        return (parseFloat(client.balance || '0') + balanceOffset).toFixed(2);
    };

    return {
        balance: getOverriddenBalance(),
        is_special_demo
    };
};
