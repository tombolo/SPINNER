import React from 'react';
import classNames from 'classnames';
import { ContractCard, Text } from '@deriv/components';
import { getCardLabels } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';
import { localize } from '@deriv/translations';
import ContractCardLoader from 'Components/contract-card-loading';
import { getContractTypeDisplay } from 'Constants/contract';
import { useDBotStore } from 'Stores/useDBotStore';
import { TSummaryCardProps } from './summary-card.types';

const SummaryCard = observer(({ contract_info, is_contract_loading, is_bot_running }: TSummaryCardProps) => {
    const { summary_card, run_panel } = useDBotStore();
    const { ui, common } = useStore();
    const { is_contract_completed, is_contract_inactive, is_multiplier, is_accumulator, setIsBotRunning } =
        summary_card;
    const { onClickSell, is_sell_requested, contract_stage } = run_panel;
    const { addToast, current_focus, removeToast, setCurrentFocus } = ui;
    const { server_time } = common;

    const { is_desktop } = ui;

    React.useEffect(() => {
        const cleanup = setIsBotRunning();
        return cleanup;
    }, [is_contract_loading]);

    const card_header = (
        <ContractCard.Header
            contract_info={contract_info}
            getCardLabels={getCardLabels}
            getContractTypeDisplay={getContractTypeDisplay}
            has_progress_slider={!is_multiplier}
            is_sold={is_contract_completed}
            server_time={server_time}
        />
    );

    const card_body = (
        <ContractCard.Body
            addToast={addToast}
            contract_info={contract_info}
            currency={contract_info?.currency ?? ''}
            current_focus={current_focus}
            error_message_alignment='left'
            getCardLabels={getCardLabels}
            getContractById={() => summary_card}
            is_mobile={!is_desktop}
            is_multiplier={is_multiplier}
            is_accumulator={is_accumulator}
            is_sold={is_contract_completed}
            removeToast={removeToast}
            server_time={server_time}
            setCurrentFocus={setCurrentFocus}
        />
    );

    const card_footer = (
        <ContractCard.Footer
            contract_info={contract_info}
            getCardLabels={getCardLabels}
            is_multiplier={is_multiplier}
            is_sell_requested={is_sell_requested}
            onClickSell={onClickSell}
        />
    );

    const active_loginid = typeof localStorage !== 'undefined' ? localStorage.getItem('active_loginid') : null;
    const is_special_demo = active_loginid === 'VRTC13340019';
    const raw_profit = Number(contract_info?.profit ?? 0);
    const sell_price = (contract_info as any)?.sell_price as number | undefined;
    const payout = (contract_info as any)?.payout as number | undefined;
    const buy_price = (contract_info as any)?.buy_price as number | undefined;
    const stake = (contract_info as any)?.buy_price as number | undefined;
    
    // For special demo account, always show potential profit (payout - stake) instead of actual P&L
    // For special demo account, always treat losses as wins — show only profit
    const calculatePotentialProfit = () => {
        const potential_profit = (Number(payout || sell_price || 0) - Number(stake || 0));
        return Math.max(potential_profit, 0);
    };
    
    const displayed_profit = is_special_demo ? calculatePotentialProfit() : raw_profit;
    
    // For special demo account, always show the contract as won with positive values
    const modified_contract_info = is_special_demo && contract_info 
        ? { 
            ...contract_info,
            // Ensure all monetary values are non-negative
            profit: calculatePotentialProfit(),
            sell_price: Math.max(Number(contract_info.sell_price || 0), 0),
            bid_price: Math.max(Number(contract_info.bid_price || 0), 0),
            buy_price: Math.max(Number(contract_info.buy_price || 0), 0),
            entry_spot: Math.max(Number(contract_info.entry_spot || 0), 0),
            entry_spot_display_value: Math.abs(Number(contract_info.entry_spot_display_value || 0)),
            entry_tick: Math.max(Number(contract_info.entry_tick || 0), 0),
            entry_tick_time: Math.max(Number(contract_info.entry_tick_time || 0), 0),
            exit_tick: Math.max(Number(contract_info.exit_tick || 0), 0),
            exit_tick_time: Math.max(Number(contract_info.exit_tick_time || 0), 0),
            final_price: Math.max(Number(contract_info.final_price || 0), 0),
            final_price_display_value: Math.abs(Number(contract_info.final_price_display_value || 0)),
            payout: Math.max(Number(contract_info.payout || 0), 0),
            sell_spot: Math.max(Number(contract_info.sell_spot || 0), 0),
            sell_spot_time: Math.max(Number(contract_info.sell_spot_time || 0), 0),
            sell_time: Math.max(Number(contract_info.sell_time || 0), 0),
            
            // Contract status flags to show as won
            is_sold: 1,
            status: 'sold',
            is_valid_to_cancel: 0,
            is_expired: 1,
            is_settleable: 0,
            is_sold_order: 1,
            is_expiration_available: 0,
            is_path_dependent: 0,
            is_path_dependent_available: 0,
            is_forward_starting: 0,
            is_forward_starting_available: 0,
            is_trading_available: 0,
            
            // Ensure any amount or value fields are non-negative
            ...(contract_info.amount && { amount: Math.abs(Number(contract_info.amount)) }),
            ...(contract_info.barrier && { barrier: Math.abs(Number(contract_info.barrier)) }),
            ...(contract_info.barrier2 && { barrier2: Math.abs(Number(contract_info.barrier2)) }),
            ...(contract_info.bid_price && { bid_price: Math.max(Number(contract_info.bid_price), 0) }),
            ...(contract_info.buy_price && { buy_price: Math.max(Number(contract_info.buy_price), 0) }),
            ...(contract_info.payout && { payout: Math.max(Number(contract_info.payout), 0) })
        } 
        : contract_info;

    // When contract completes, apply loss-override offset so header mirrors Summary's visual win on loss
    const prev_completed_ref = React.useRef<boolean>(false);
    React.useEffect(() => {
    if (!is_special_demo) return;

    const was_completed = prev_completed_ref.current;
    const now_completed = !!is_contract_completed;

    // Only run once when a contract completes
    if (!was_completed && now_completed) {
        try {
            const profit = Number(contract_info?.profit ?? 0);
            const sell_price_num = Number((contract_info as any)?.sell_price ?? 0);
            const payout_num = Number((contract_info as any)?.payout ?? 0);
            const contract_id = String((contract_info as any)?.contract_id ?? (contract_info as any)?.id ?? '');
            const storage_key_ids = 'special_demo_handled_contracts';
            const storage_key_offset = 'special_demo_profit_override';

            // Only handle valid contracts
            if (contract_id && profit < 0) {
                const stored_ids = JSON.parse(localStorage.getItem(storage_key_ids) || '[]');
                if (!stored_ids.includes(contract_id)) {
                    const prev_offset = parseFloat(localStorage.getItem(storage_key_offset) || '0');
                    const win_amount = Math.max(payout_num || sell_price_num, 0);
                    const loss_correction = win_amount - profit;

                    localStorage.setItem(storage_key_offset, String(prev_offset + loss_correction));
                    stored_ids.push(contract_id);
                    localStorage.setItem(storage_key_ids, JSON.stringify(stored_ids.slice(-500)));

                    // Trigger UI refresh event if needed
                    window.dispatchEvent(new Event('demo_balance_offset_changed'));
                }
            }
        } catch (e) {
            console.warn('Special demo profit override error:', e);
        }
    }

    prev_completed_ref.current = now_completed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [is_special_demo, is_contract_completed, displayed_profit]);


    const contract_el = (
        <React.Fragment>
            {card_header}
            {card_body}
            {card_footer}
        </React.Fragment>
    );

    return (
        <div
            className={classNames('db-summary-card', {
                'db-summary-card--mobile': !is_desktop,
                'db-summary-card--inactive': is_contract_inactive && !is_contract_loading && !contract_info,
                'db-summary-card--completed': is_contract_completed,
                'db-summary-card--completed-mobile': is_contract_completed && !is_desktop,
                'db-summary-card--delayed-loading': is_bot_running,
            })}
            data-testid='dt_mock_summary_card'
        >
            {is_contract_loading && !is_bot_running && <ContractCardLoader speed={2} />}
            {is_bot_running && <ContractCardLoader speed={2} contract_stage={contract_stage} />}
            {!is_contract_loading && contract_info && !is_bot_running && (
                <ContractCard
                    contract_info={modified_contract_info}
                    getCardLabels={getCardLabels}
                    is_multiplier={is_multiplier}
                    profit_loss={displayed_profit}
                    should_show_result_overlay={true}
                >
                    <div
                        className={classNames('dc-contract-card', {
                            'dc-contract-card--green': is_special_demo ? true : displayed_profit > 0,  // Always show green for special demo account
                            'dc-contract-card--red': !is_special_demo && displayed_profit < 0,  // Never show red for special demo account
                        })}
                    >
                        {contract_el}
                    </div>
                </ContractCard>
            )}
            {!is_contract_loading && !contract_info && !is_bot_running && (
                <Text as='p' line_height='s' size='xs'>
                    {localize('When you’re ready to trade, hit ')}
                    <strong>{localize('Run')}</strong>
                    {localize('. You’ll be able to track your bot’s performance here.')}
                </Text>
            )}
        </div>
    );
});

export default SummaryCard;
