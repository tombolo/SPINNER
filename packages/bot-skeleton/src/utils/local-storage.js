import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';

// Import legacy bots
import Auto102ByLegacyHub from './legacy/AUTO102BYLEGACYHUB.xml';
import EvenEvenOddOddBot from './legacy/EVENEVEN_ODDODDBot.xml';
import EnhancedAutoSwitchOver2Bot from './legacy/EnhancedAutoSwitchOver2bot.xml';
import OddOddEvenEvenBot from './legacy/ODDODDEVENEVENBOT.xml';
import OverDestroyerByLegacy from './legacy/OVERDESTROYERBYLEGACY.xml';
import Under7_8_AIBot from './legacy/Under7_8_AIBOT.xml';
import UnderoverAutoswitch from './legacy/UnderoverAutoswitch.xml';
import LegacyQ1 from './legacy/legacyQ1.xml';
import LegacyV1SpeedBot from './legacy/legacyv1speedbot.xml';
import Stakelist101 from './legacy/stakelist101.xml';

// Import bots from master folder
import AutoV1ByStateFX from './master/AUTOV1BYSTATESFX.xml';
import DerivWizard from './master/Derivwizard.xml';
import EnhancedV1ByStateFX from './master/ENHANCEDV1BYSTATEFX.xml';
import MasterG8ByStateFX from './master/MasterG8ByStateFx.xml';
import MetroV4EvenOddBot from './master/Metrov4EvenandOddDigitBotUpdated.xml';
import StateHNR from './master/STATEHNR.xml';
import StateXV1 from './master/STATEXV1.xml';
import V4EvenOddBot from './master/V4EvenandOddDigitBot.xml';
import Dollarflipper from './buru/Dollarflipper2.0.xml';
import Dollarminer from './buru/Dollarminer.xml';
import EvenOddAutoSwitcher from './buru/EvenOddAutoSwitcher.xml';
import VxAutoSwitcher from './buru/Vx.xml';


// Ensure Blockly is available globally
const getBlockly = () => {
    if (typeof window !== 'undefined' && window.Blockly) {
        return window.Blockly;
    }
    throw new Error('Blockly not available - workspace not initialized');
};

// Static bot configurations - Legacy bots first, then master bots
const STATIC_BOTS = {
    auto_102_by_legacy_hub: {
        id: 'auto_102_by_legacy_hub',
        name: 'Auto 102',
        xml: Auto102ByLegacyHub,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    even_even_odd_odd_bot: {
        id: 'even_even_odd_odd_bot',
        name: 'Even Even Odd Odd Bot',
        xml: EvenEvenOddOddBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    enhanced_auto_switch_over_2: {
        id: 'enhanced_auto_switch_over_2',
        name: 'Enhanced Auto Switch Over 2',
        xml: EnhancedAutoSwitchOver2Bot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    odd_odd_even_even_bot: {
        id: 'odd_odd_even_even_bot',
        name: 'Odd Odd Even Even Bot',
        xml: OddOddEvenEvenBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    over_destroyer_by_legacy: {
        id: 'over_destroyer_by_legacy',
        name: 'Over Destroyer',
        xml: OverDestroyerByLegacy,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    under_7_8_ai_bot: {
        id: 'under_7_8_ai_bot',
        name: 'Under 7/8 AI Bot',
        xml: Under7_8_AIBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    underover_autoswitch: {
        id: 'underover_autoswitch',
        name: 'Underover Autoswitch',
        xml: UnderoverAutoswitch,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    legacy_q1: {
        id: 'legacy_q1',
        name: 'L Q1',
        xml: LegacyQ1,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    legacy_v1_speed_bot: {
        id: 'legacy_v1_speed_bot',
        name: 'V1 Speed Bot',
        xml: LegacyV1SpeedBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    stakelist_101: {
        id: 'stakelist_101',
        name: 'Stakelist 101',
        xml: Stakelist101,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    dollar_flipper: {
        id: 'dollar_flipper',
        name: 'Dollar Flipper',
        xml: Dollarflipper,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    dollar_miner: {
        id: 'dollar_miner',
        name: 'Dollar Miner',
        xml: Dollarminer,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    even_odd_auto_switcher: {
        id: 'even_odd_auto_switcher',
        name: 'Even Odd Auto Switcher',
        xml: EvenOddAutoSwitcher,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    vx_auto_switcher: {
        id: 'vx_auto_switcher',
        name: 'Vx Auto Switcher',
        xml: VxAutoSwitcher,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    auto_v1: {
        id: 'auto_v1',
        name: 'Auto V1 By State FX',
        xml: AutoV1ByStateFX,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    deriv_wizard: {
        id: 'deriv_wizard',
        name: 'Deriv Wizard',
        xml: DerivWizard,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    enhanced_v1: {
        id: 'enhanced_v1',
        name: 'Enhanced V1',
        xml: EnhancedV1ByStateFX,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    master_g8: {
        id: 'master_g8',
        name: 'Gainer xvt scun entry point',
        xml: MasterG8ByStateFX,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    metro_v4: {
        id: 'metro_v4',
        name: 'Metro V4 Even Odd Bot',
        xml: MetroV4EvenOddBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    state_hnr: {
        id: 'state_hnr',
        name: 'Entry HNR',
        xml: StateHNR,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    state_xv1: {
        id: 'state_xv1',
        name: 'Entry XV1',
        xml: StateXV1,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    v4_even_odd: {
        id: 'v4_even_odd',
        name: 'V4 Even Odd Bot',
        xml: V4EvenOddBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    }
};

const getStaticBots = () => Object.values(STATIC_BOTS);

/**
 * 🔒 Disable saving bots
 */
export const saveWorkspaceToRecent = async () => {
    console.warn('[INFO] Saving disabled → Using static bots only.');
    const {
        load_modal: { updateListStrategies },
    } = DBotStore.instance;
    updateListStrategies(getStaticBots());
};

/**
 * ✅ Always return static bots
 */
export const getSavedWorkspaces = async () => {
    const bots = getStaticBots();
    console.log(
        '[DEBUG] Available static bots:',
        bots.map(bot => bot.id)
    );
    return bots;
};

/**
 * Load a bot by ID (from static list only)
 */
export const loadStrategy = async strategy_id => {
    console.log(`[DEBUG] Attempting to load bot: ${strategy_id}`);

    // Check for duplicate IDs
    const staticBots = getStaticBots();
    const duplicateIds = staticBots.filter((bot, index) => staticBots.findIndex(b => b.id === bot.id) !== index);

    if (duplicateIds.length > 0) {
        console.error(
            '[ERROR] Duplicate bot IDs found:',
            duplicateIds.map(b => b.id)
        );
    }

    const strategy = staticBots.find(bot => bot.id === strategy_id);

    if (!strategy) {
        console.error(
            `[ERROR] Bot with id "${strategy_id}" not found. Available bots:`,
            staticBots.map(b => b.id)
        );
        return false;
    }

    try {
        // Check if workspace is initialized
        if (!Blockly.derivWorkspace) {
            console.error('[ERROR] Blockly workspace not initialized');
            return false;
        }

        // Clear existing workspace first
        console.log('[DEBUG] Clearing existing workspace');
        Blockly.derivWorkspace.clear();

        const parser = new DOMParser();
        const xmlDom = parser.parseFromString(strategy.xml, 'text/xml').documentElement;

        // Check if XML is valid
        if (xmlDom.querySelector('parsererror')) {
            console.error('[ERROR] Invalid XML content for bot:', strategy_id);
            return false;
        }

        const convertedXml = convertStrategyToIsDbot(xmlDom);

        Blockly.Xml.domToWorkspace(convertedXml, Blockly.derivWorkspace);
        Blockly.derivWorkspace.current_strategy_id = strategy_id;

        console.log(`[SUCCESS] Loaded static bot: ${strategy.name} (ID: ${strategy_id})`);
        return true;
    } catch (error) {
        console.error('Error loading static bot:', error);
        return false;
    }
};

/**
 * 🔒 Disable removing bots
 */
export const removeExistingWorkspace = async () => {
    console.warn('[INFO] Remove disabled → Static bots only.');
    return false;
};

/**
 * Ensure xml has `is_dbot` flag
 */
export const convertStrategyToIsDbot = xml_dom => {
    if (!xml_dom) return;
    xml_dom.setAttribute('is_dbot', 'true');
    return xml_dom;
};

// 🧹 Clear storage & recents at startup
localStorage.removeItem('saved_workspaces');
localStorage.removeItem('recent_strategies');
console.log('[INFO] Cleared saved/recent bots → Static bots only.');