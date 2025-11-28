import { getLoginHistory, clearLoginHistory, trackLogin, LoginDetails } from './loginTracker';

// Add utility functions to the window object for easy access from the console
declare global {
    interface Window {
        // View the login history
        getLoginHistory: () => LoginDetails[];
        // Clear the login history
        clearLoginHistory: () => void;
        // Manually track a login (for testing)
        trackTestLogin: (loginId: string, token: string, balance: number) => void;
        // Get the latest login details
        getLatestLogin: () => LoginDetails | null;
    }
}

// Add utility functions to the window object
if (typeof window !== 'undefined') {
    // View login history
    window.getLoginHistory = getLoginHistory;
    
    // Clear login history
    window.clearLoginHistory = clearLoginHistory;
    
    // Manually track a login (for testing)
    window.trackTestLogin = (loginId: string, token: string, balance: number) => {
        trackLogin({ loginId, token, balance });
        console.log('Test login tracked:', { loginId, token, balance });
    };
    
    // Get the most recent login
    window.getLatestLogin = (): LoginDetails | null => {
        const history = getLoginHistory();
        return history.length > 0 ? history[0] : null;
    };
    
    // Log a helpful message with available console commands
    console.log('%cLogin Tracker Utilities:', 'color: #4CAF50; font-weight: bold');
    console.log('- getLoginHistory(): View all stored login details');
    console.log('- getLatestLogin(): Get the most recent login details');
    console.log('- trackTestLogin(loginId, token, balance): Manually track a login');
    console.log('- clearLoginHistory(): Clear all stored login details');
    console.log('\nAccess these functions directly in the console.');
}
