import { LocalStore } from '../storage/storage';

const MAX_LOGIN_HISTORY = 50; // Maximum number of logins to keep in history

export interface LoginDetails {
    loginId: string;
    token: string;
    balance: string | number;
    timestamp: string;
    userAgent: string;
    ipAddress?: string; // Note: This will only be available if your backend provides it
}

export const trackLogin = (details: Omit<LoginDetails, 'timestamp' | 'userAgent'>) => {
    try {
        const loginHistory = getLoginHistory();
        
        const newLogin: LoginDetails = {
            ...details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };
        
        // Add new login to the beginning of the array
        loginHistory.unshift(newLogin);
        
        // Keep only the most recent logins
        const trimmedHistory = loginHistory.slice(0, MAX_LOGIN_HISTORY);
        
        // Save to localStorage
        LocalStore.set('login_history', JSON.stringify(trimmedHistory));
        
        return newLogin;
    } catch (error) {
        console.error('Error tracking login:', error);
        return null;
    }
};

export const getLoginHistory = (): LoginDetails[] => {
    try {
        const history = LocalStore.get('login_history');
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Error reading login history:', error);
        return [];
    }
};

export const clearLoginHistory = (): void => {
    try {
        LocalStore.set('login_history', JSON.stringify([]));
    } catch (error) {
        console.error('Error clearing login history:', error);
    }
};
