import React from 'react';
import classNames from 'classnames';
import { Icon, Text } from '@deriv/components';
import { observer } from '@deriv/stores';
import { localize } from '@deriv/translations';
import { DBOT_TABS } from 'Constants/bot-contents';
import { useDBotStore } from 'Stores/useDBotStore';
import { rudderStackSendOpenEvent } from '../../analytics/rudderstack-common-events';
import { rudderStackSendDashboardClickEvent } from '../../analytics/rudderstack-dashboard';
import DashboardBotList from './bot-list/dashboard-bot-list';

type TCardProps = {
    has_dashboard_strategies: boolean;
    is_mobile: boolean;
    children?: React.ReactNode;
};

type TCardArray = {
    type: string;
    icon: string;
    content: string;
    callback: () => void;
};

const Cards = observer(({ is_mobile, has_dashboard_strategies, children }: TCardProps) => {
    const cardIcons = {
        'my-computer': 'IcMyComputer',
        'google-drive': 'IcGoogleDriveDbot',
        'bot-builder': 'IcBotBuilder',
        'quick-strategy': 'IcQuickStrategy',
    };

    const cardDescriptions = {
        'my-computer': localize('Upload your bot from your device'),
        'google-drive': localize('Access your saved bots from Google Drive'),
        'bot-builder': localize('Build your bot from scratch with our visual editor'),
        'quick-strategy': localize('Use pre-built strategies to get started quickly'),
    };
    const { dashboard, load_modal, quick_strategy } = useDBotStore();
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { is_dialog_open, setActiveTab } = dashboard;
    const { setFormVisibility } = quick_strategy;

    const openGoogleDriveDialog = () => {
        toggleLoadModal();
        setActiveTabIndex(is_mobile ? 1 : 2);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openFileLoader = () => {
        toggleLoadModal();
        setActiveTabIndex(is_mobile ? 0 : 1);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const actions: TCardArray[] = [
        {
            type: 'my-computer',
            icon: is_mobile ? 'IcLocal' : 'IcMyComputer',
            content: is_mobile ? localize('Local') : localize('My computer'),
            callback: () => {
                openFileLoader();
                rudderStackSendOpenEvent({
                    subpage_name: 'bot_builder',
                    subform_source: 'dashboard',
                    subform_name: 'load_strategy',
                    load_strategy_tab: 'local',
                });
            },
        },
        {
            type: 'google-drive',
            icon: 'IcGoogleDriveDbot',
            content: localize('Google Drive'),
            callback: () => {
                openGoogleDriveDialog();
                rudderStackSendOpenEvent({
                    subpage_name: 'bot_builder',
                    subform_source: 'dashboard',
                    subform_name: 'load_strategy',
                    load_strategy_tab: 'google drive',
                });
            },
        },
        {
            type: 'bot-builder',
            icon: 'IcBotBuilder',
            content: localize('Bot Builder'),
            callback: () => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                rudderStackSendDashboardClickEvent({
                    dashboard_click_name: 'bot_builder',
                    subpage_name: 'bot_builder',
                });
            },
        },
        {
            type: 'quick-strategy',
            icon: 'IcQuickStrategy',
            content: localize('Quick strategy'),
            callback: () => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                setFormVisibility(true);
                rudderStackSendOpenEvent({
                    subpage_name: 'bot_builder',
                    subform_source: 'dashboard',
                    subform_name: 'quick_strategy',
                });
            },
        },
    ];

    return React.useMemo(
        () => (
            <div className='dashboard-cards'>
                <div className='dashboard-cards__grid'>
                    {actions.map((action) => (
                        <div
                            key={action.type}
                            className={classNames('dashboard-card', {
                                'dashboard-card--minimized': has_dashboard_strategies && is_mobile,
                            })}
                            onClick={action.callback}
                            onKeyDown={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter') {
                                    action.callback();
                                }
                            }}
                            tabIndex={0}
                        >
                            <div className='dashboard-card__icon'>
                                <Icon
                                    icon={action.icon}
                                    width={is_mobile ? '32' : '40'}
                                    height={is_mobile ? '32' : '40'}
                                />
                            </div>
                            <div className='dashboard-card__content'>
                                <Text
                                    as='h3'
                                    weight='bold'
                                    size={is_mobile ? 'xs' : 's'}
                                    line_height='m'
                                    className='dashboard-card__title'
                                >
                                    {action.content}
                                </Text>
                                <Text
                                    as='p'
                                    size={is_mobile ? 'xxs' : 'xs'}
                                    line_height='m'
                                    className='dashboard-card__description'
                                >
                                    {cardDescriptions[action.type as keyof typeof cardDescriptions]}
                                </Text>
                            </div>
                            <div className='dashboard-card__arrow'>
                                <Icon icon='IcChevronRight' size={16} />
                            </div>
                        </div>
                    ))}
                </div>
                {children}
                <DashboardBotList />
            </div>
        ),
        [is_dialog_open, has_dashboard_strategies, children, actions]
    );
});

export default Cards;
