import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from '@deriv/stores';
import { Localize } from '@deriv/translations';
import { Button, Input, Text, Icon, SelectNative, Loading } from '@deriv/components';
import { formatMoney } from '@deriv/shared';
import { useStore } from '@deriv/stores';
import './speedbot.scss';

interface StrategyState {
    entryPoint: number;
    predictionBeforeLoss: number;
    predictionAfterLoss: number;
    initialStake: number;
    nextStake: number;
    takeProfit: number;
    stopLoss: number;
    martingaleLevel: number;
    isRunning: boolean;
    currentStake: number;
    totalProfit: number;
    lastTrade: 'win' | 'loss' | null;
    selectedMarket: string;
    marketSymbol: string;
    volatility: number;
}

interface VolatilityMarket {
    text: string;
    value: string;
    symbol: string;
    volatility: number;
}

const VOLATILITY_MARKETS: VolatilityMarket[] = [
    { 
        text: 'Volatility 10 (1s) Index', 
        value: '1HZ10V',
        symbol: 'R_10',
        volatility: 0.3
    },
    { 
        text: 'Volatility 25 (1s) Index', 
        value: '1HZ25V',
        symbol: 'R_25',
        volatility: 0.4
    },
    { 
        text: 'Volatility 50 (1s) Index', 
        value: '1HZ50V',
        symbol: 'R_50',
        volatility: 0.5
    },
    { 
        text: 'Volatility 75 (1s) Index', 
        value: '1HZ75V',
        symbol: 'R_75',
        volatility: 0.6
    },
    { 
        text: 'Volatility 100 (1s) Index', 
        value: '1HZ100V',
        symbol: 'R_100',
        volatility: 0.7
    }
];

const DEFAULT_MARKET = VOLATILITY_MARKETS[2]; // Default to Volatility 50

const SpeedBot = observer(() => {
    const { client } = useStore();
    const [isStrategyRunning, setIsStrategyRunning] = useState(false);
    const [strategy, setStrategy] = useState<Omit<StrategyState, 'isRunning' | 'currentStake' | 'totalProfit' | 'lastTrade'>>({
        entryPoint: 1,
        predictionBeforeLoss: 1,
        predictionAfterLoss: 6,
        initialStake: 1,
        nextStake: 1.9,
        takeProfit: 5,
        stopLoss: -10,
        martingaleLevel: 2,
        selectedMarket: DEFAULT_MARKET.value,
        marketSymbol: DEFAULT_MARKET.symbol,
        volatility: DEFAULT_MARKET.volatility,
    });
    
    const [executionState, setExecutionState] = useState({
        isRunning: false,
        currentStake: 1,
        totalProfit: 0,
        lastTrade: null as 'win' | 'loss' | null,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tradeHistory, setTradeHistory] = useState<Array<{
        id: number;
        timestamp: Date;
        stake: number;
        prediction: number;
        result: 'win' | 'loss';
        profit: number;
    }>>([]);

    // Use ref to access current state in callbacks
    const stateRef = useRef({
        ...strategy,
        ...executionState
    });
    useEffect(() => {
        stateRef.current = {
            ...strategy,
            ...executionState
        };
    }, [strategy, executionState]);

    const handleInputChange = (field: keyof typeof strategy, value: string | number) => {
        const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        setStrategy(prev => ({
            ...prev,
            [field]: numValue,
        }));
    };

    const validateInputs = () => {
        if (strategy.initialStake <= 0) {
            setError('Initial stake must be greater than 0');
            return false;
        }
        if (strategy.predictionBeforeLoss < 1 || strategy.predictionBeforeLoss > 9) {
            setError('Prediction before loss must be between 1 and 9');
            return false;
        }
        if (strategy.predictionAfterLoss < 1 || strategy.predictionAfterLoss > 9) {
            setError('Prediction after loss must be between 1 and 9');
            return false;
        }
        if (strategy.takeProfit <= 0) {
            setError('Take profit must be greater than 0');
            return false;
        }
        if (strategy.stopLoss >= 0) {
            setError('Stop loss must be less than 0');
            return false;
        }
        if (strategy.martingaleLevel < 1) {
            setError('Martingale level must be at least 1');
            return false;
        }
        setError(null);
        return true;
    };

    const simulateTrade = useCallback(async (stake: number, prediction: number): Promise<boolean> => {
        // In a real implementation, this would call the Deriv API to place a trade
        // For now, we'll simulate the trade with some randomness based on the selected market
        const market = VOLATILITY_MARKETS.find(m => m.value === strategy.selectedMarket) || DEFAULT_MARKET;
        
        // Simulate market conditions based on the selected volatility index
        const baseWinRate = 0.5; // Base win rate
        const volatilityFactor = market.volatility; // Higher volatility = more variance
        const winRate = Math.min(0.9, Math.max(0.1, baseWinRate + (Math.random() - 0.5) * volatilityFactor));
        
        // Add some delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        return Math.random() < winRate;
    }, []);

    const startStrategy = () => {
        if (!validateInputs()) return;
        
        // Initialize execution state
        setExecutionState({
            isRunning: true,
            currentStake: strategy.initialStake,
            totalProfit: 0,
            lastTrade: null,
        });
        
        setIsStrategyRunning(true);
    };
    
    const stopStrategy = () => {
        setIsStrategyRunning(false);
        setExecutionState(prev => ({
            ...prev,
            isRunning: false
        }));
    };
    
    // Effect to handle strategy execution
    useEffect(() => {
        if (!executionState.isRunning) return;
        
        let isMounted = true;
        
        const runStrategy = async () => {
            let currentStake = executionState.currentStake;
            let currentPrediction = strategy.predictionBeforeLoss;
            let consecutiveLosses = 0;
            let tradeCount = 0;
            const maxTrades = 100; // Safety limit

            while (isMounted && executionState.isRunning && 
                   executionState.totalProfit < strategy.takeProfit && 
                   executionState.totalProfit > strategy.stopLoss && 
                   tradeCount < maxTrades) {
                
                tradeCount++;
                
                try {
                    const isWin = await simulateTrade(currentStake, currentPrediction);
                    const profit = isWin ? currentStake * 0.9 : -currentStake;
                    
                    if (!isMounted) return;
                    
                    // Update execution state
                    const newTotalProfit = executionState.totalProfit + profit;
                    const newStake = isWin ? strategy.initialStake : currentStake * strategy.martingaleLevel;
                    
                    setExecutionState(prev => ({
                        ...prev,
                        totalProfit: newTotalProfit,
                        currentStake: newStake,
                        lastTrade: isWin ? 'win' : 'loss',
                        isRunning: !(newTotalProfit >= strategy.takeProfit || newTotalProfit <= strategy.stopLoss)
                    }));
                    
                    // Add to trade history
                    setTradeHistory(prev => {
                        const result: 'win' | 'loss' = isWin ? 'win' : 'loss';
                        return [{
                            id: Date.now() + tradeCount,
                            timestamp: new Date(),
                            stake: currentStake,
                            prediction: currentPrediction,
                            result,
                            profit,
                        }, ...prev].slice(0, 50); // Keep last 50 trades
                    });
                    
                    if (isWin) {
                        currentStake = strategy.initialStake;
                        currentPrediction = strategy.predictionBeforeLoss;
                        consecutiveLosses = 0;
                    } else {
                        consecutiveLosses++;
                        currentStake = strategy.initialStake * Math.pow(strategy.martingaleLevel, consecutiveLosses);
                        currentPrediction = strategy.predictionAfterLoss;
                    }
                    
                } catch (error) {
                    console.error('Trade error:', error);
                    // Add a small delay before retrying
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Add small delay between trades for better UX and to avoid rate limiting
                if (isMounted && executionState.isRunning) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (isMounted) {
                if (executionState.totalProfit >= strategy.takeProfit) {
                    console.log('Take profit reached!');
                } else if (executionState.totalProfit <= strategy.stopLoss) {
                    console.log('Stop loss hit!');
                }
                setIsStrategyRunning(false);
            }
        };
        
        runStrategy();
        
        return () => {
            isMounted = false;
        };
    }, [executionState.isRunning]);

    const resetStrategy = () => {
        setExecutionState({
            isRunning: false,
            currentStake: strategy.initialStake,
            totalProfit: 0,
            lastTrade: null,
        });
        setTradeHistory([]);
        setError(null);
    };

    // Handle market change
    const handleMarketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        const selectedMarket = VOLATILITY_MARKETS.find(market => market.value === selectedValue) || DEFAULT_MARKET;
        
        setStrategy(prev => ({
            ...prev,
            selectedMarket: selectedMarket.value,
            marketSymbol: selectedMarket.symbol,
            volatility: selectedMarket.volatility
        }));
    };

    // Get market color based on volatility
    const getMarketColor = () => {
        switch(strategy.selectedMarket) {
            case '1HZ10V': return '#4caf50'; // Green
            case '1HZ25V': return '#8bc34a'; // Light Green
            case '1HZ50V': return '#2196f3'; // Blue
            case '1HZ75V': return '#ff9800'; // Orange
            case '1HZ100V': return '#f44336'; // Red
            default: return '#2196f3'; // Blue
        }
    };

    return (
        <div className='speedbot-container' style={{
            '--primary-color': '#2196f3',
            '--profit-color': '#4caf50',
            '--loss-color': '#f44336',
            '--market-color': getMarketColor()
        } as React.CSSProperties}>
            <div className='speedbot-maintenance-banner'>
                <Icon icon='IcAlertWarning' className='maintenance-icon' />
                <Text as='p' size='s' className='maintenance-text'>
                    <Localize i18n_default_text='SpeedBot is currently under maintenance. Some features may be limited or unavailable.' />
                </Text>
            </div>
            <div className='speedbot-header'>
                <Text as='h1' weight='bold' className='speedbot-title'>
                    <Icon icon='IcTradingPlatform' className='speedbot-title-icon' />
                    <Localize i18n_default_text='SpeedBot Pro' />
                </Text>
                
                <div className='speedbot-market-selector'>
                    <Text as='p' className='speedbot-label' size='s'>
                        <Localize i18n_default_text='Market Volatility' />
                    </Text>
                    <SelectNative
                        data-testid='market-selector'
                        className='speedbot-select'
                        value={strategy.selectedMarket}
                        list_items={VOLATILITY_MARKETS.map(market => ({
                            text: market.text,
                            value: market.value
                        }))}
                        onChange={handleMarketChange}
                        disabled={isStrategyRunning}
                    />
                </div>
            </div>
            
            {error && (
                <div className='speedbot-error'>
                    <Icon icon='IcAlertDanger' />
                    <Text as='p' size='xs' color='loss-danger'>
                        {error}
                    </Text>
                </div>
            )}

            <div className='speedbot-controls-card'>
                <div className='speedbot-section'>
                    <div className='speedbot-section-header'>
                        <Icon icon='IcCog' className='speedbot-section-icon' />
                        <Text as='h3' weight='bold' className='speedbot-section-title'>
                            <Localize i18n_default_text='Strategy Settings' />
                        </Text>
                    </div>
                    
                    <div className='speedbot-controls-grid'>
                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Prediction Before Loss' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.predictionBeforeLoss}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('predictionBeforeLoss', e.target.value)}
                                min='1'
                                max='9'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Prediction After Loss' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.predictionAfterLoss}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('predictionAfterLoss', e.target.value)}
                                min='1'
                                max='9'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Initial Stake (USD)' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.initialStake}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('initialStake', e.target.value)}
                                min='1'
                                step='0.1'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Next Stake (USD)' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.nextStake}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('nextStake', e.target.value)}
                                min='1'
                                step='0.1'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Take Profit (USD)' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.takeProfit}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('takeProfit', e.target.value)}
                                min='1'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Stop Loss (USD)' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.stopLoss}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('stopLoss', e.target.value)}
                                max='-1'
                            />
                        </div>

                        <div className='speedbot-control'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Martingale Level' />
                            </Text>
                            <Input
                                type='number'
                                value={strategy.martingaleLevel}
                                disabled={isStrategyRunning}
                                onChange={(e) => handleInputChange('martingaleLevel', e.target.value)}
                                min='1'
                                step='0.1'
                            />
                        </div>
                    </div>
                </div>

                <div className='speedbot-section'>
                    <div className='speedbot-section-header'>
                        <Icon icon='IcDashboard' className='speedbot-section-icon' />
                        <Text as='h3' weight='bold' className='speedbot-section-title'>
                            <Localize i18n_default_text='Trading Status' />
                        </Text>
                    </div>
                    
                    <div className='speedbot-status'>
                        <div className='speedbot-status-item'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Status' />
                            </Text>
                            <Text as='p' weight='bold' color={executionState.isRunning ? 'profit-success' : 'loss-danger'}>
                                {executionState.isRunning ? 'RUNNING' : 'STOPPED'}
                            </Text>
                        </div>

                        <div className='speedbot-status-item'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Current Stake' />
                            </Text>
                            <Text as='p' weight='bold' color='profit-success' size='l'>
                                {formatMoney(client.currency, executionState.currentStake, true)}
                            </Text>
                        </div>

                        <div className='speedbot-status-item'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Total Profit/Loss' />
                            </Text>
                            <Text 
                                as='p' 
                                weight='bold' 
                                color={executionState.totalProfit >= 0 ? 'profit-success' : 'loss-danger'}
                            >
                                {formatMoney(client.currency, Math.abs(executionState.totalProfit), true, 2)}
                                {executionState.totalProfit >= 0 ? ' PROFIT' : ' LOSS'}
                            </Text>
                        </div>

                        <div className='speedbot-status-item'>
                            <Text as='p' className='speedbot-label'>
                                <Localize i18n_default_text='Last Trade' />
                            </Text>
                            <Text 
                                as='p' 
                                weight='bold' 
                                color={executionState.lastTrade === 'win' ? 'profit-success' : 'loss-danger'}
                            >
                                {executionState.lastTrade ? (
                                    <span className={executionState.lastTrade === 'win' ? 'text-profit' : 'text-loss'}>
                                        {executionState.lastTrade.toUpperCase()}
                                    </span>
                                ) : '-'}
                            </Text>
                        </div>
                    </div>

                    <div className='speedbot-actions'>
                        <div className='speedbot-actions-buttons'>
                            {!isStrategyRunning ? (
                                <Button
                                    className='speedbot-action-btn run'
                                    onClick={startStrategy}
                                    disabled={isLoading || executionState.isRunning}
                                    large
                                >
                                    <Icon icon='IcPlay' className='btn-icon' />
                                    <Localize i18n_default_text='Run Strategy' />
                                </Button>
                            ) : (
                                <Button
                                    className='speedbot-action-btn stop'
                                    onClick={stopStrategy}
                                    disabled={!executionState.isRunning || isLoading}
                                    large
                                >
                                    <Icon icon='IcCross' className='btn-icon' />
                                    <Localize i18n_default_text='Stop' />
                                </Button>
                            )}
                            <Button
                                className='speedbot-action-btn reset'
                                onClick={resetStrategy}
                                disabled={isStrategyRunning || isLoading}
                                large
                                secondary
                            >
                                <Icon icon='IcUpdate' className='btn-icon' />
                                <Localize i18n_default_text='Reset' />
                            </Button>
                        </div>
                        {!client.is_logged_in && (
                            <Text as='p' size='xs' color='loss-danger' className='login-notice'>
                                <Localize i18n_default_text='Please log in to start trading' />
                            </Text>
                        )}
                    </div>
                </div>

                {tradeHistory.length > 0 && (
                    <div className='speedbot-section'>
                        <div className='speedbot-section-header'>
                            <Icon icon='IcHistory' className='speedbot-section-icon' />
                            <Text as='h3' weight='bold' className='speedbot-section-title'>
                                <Localize i18n_default_text='Trade History' />
                            </Text>
                        </div>
                        <div className='speedbot-trade-history'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Stake</th>
                                        <th>Prediction</th>
                                        <th>Result</th>
                                        <th>P/L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tradeHistory.map(trade => (
                                        <tr key={trade.id}>
                                            <td>{trade.timestamp.toLocaleTimeString()}</td>
                                            <td>{formatMoney('USD', trade.stake, true)}</td>
                                            <td>{trade.prediction}</td>
                                            <td className={`trade-${trade.result}`}>
                                                {trade.result.toUpperCase()}
                                            </td>
                                            <td className={trade.profit >= 0 ? 'profit' : 'loss'}>
                                                {formatMoney('USD', Math.abs(trade.profit), true, 2)}
                                                {trade.profit >= 0 ? ' ✅' : ' ❌'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default SpeedBot;