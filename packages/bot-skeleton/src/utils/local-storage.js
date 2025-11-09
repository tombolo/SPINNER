import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';

// Import bots from utils/buru
import DollarFlipper from './buru/Dollarflipper2.0.xml';
import DollarMiner from './buru/Dollarminer.xml';
import EvenOddAutoSwitcher from './buru/EvenOddAutoSwitcher.xml';
import VxBot from './buru/Vx.xml';

// Import bots from utils/bots
import HMSpeedBot from './bots/$hmspeedbot$.xml';
import AutoC4VoltaiPremiumRobot from './bots/AUTOC4VOLTAIPREMIUMROBOT.xml';
import AIUnderRecoveryBot from './bots/Aiunderrecoveryunder345adjustable.xml';
import AlgoSniper from './bots/AlgoSniper.xml';
import BRAMEvenOddPrinter from './bots/BRAMEVENODDPRINTER.xml';
import BRAMSpeedBot from './bots/BRAMSPEEDBOT.xml';
import CandleMineV2 from './bots/CandlemineVersion2.xml';
import DerivWizard from './bots/Derivwizard.xml';
import DoubleOverWithAnalysis from './bots/DoubleOverWithanalysis.xml';
import EnhancedDigitSwitcherV5 from './bots/ENHANCEDDigitSwitcherVERSION5.xml';
import ExpertSpeedBot from './bots/ExpertSpeedBot.xml';
import ExpertSpeedBotByChosenDollar from './bots/ExpertSpeedBotByCHOSENDOLLARPRINTERFx.xml';
import MasterBotV6 from './bots/MASTERBOTV6UPGRADEDDBot.xml';
import MarketKiller from './bots/Marketkiller.xml';
import MrDukeV2Bot from './bots/Mrdukeov2bot.xml';
import OverDestroyerByMikeG from './bots/OVERDESTROYERBYMIKEG.xml';
import OverDestroyerByStateFX from './bots/OverDestroyerbystatefx.xml';
import ProfitGainerXVT from './bots/PROFITGAINERXVT.xml';
import ProfitGainerXVTSetup from './bots/PROFITGAINERXVTscunentrypointbeforrun.xml';
import StatesDigitSwitcherV2 from './bots/STATESDigitSwitcherV2.xml';
import SignalSniperAutoBot from './bots/SignalSniperAutoBot.xml';
import V6StrikerBot from './bots/V6strikerbot.xml';
import MasterG8OverUnder from './bots/masterG8OVERUNDERBYSTATEFXVERSION12026.xml';


// Ensure Blockly is available globally
const getBlockly = () => {
    if (typeof window !== 'undefined' && window.Blockly) {
        return window.Blockly;
    }
    throw new Error('Blockly not available - workspace not initialized');
};

// Static bot configurations - Bots from utils/buru and utils/bots
const STATIC_BOTS = {
    dollar_flipper: {
        id: 'dollar_flipper',
        name: 'Dollar Flipper 2.0',
        xml: DollarFlipper,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    dollar_miner: {
        id: 'dollar_miner',
        name: 'Dollar Miner',
        xml: DollarMiner,
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
    vx_bot: {
        id: 'vx_bot',
        name: 'VX Bot',
        xml: VxBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    hm_speed_bot: {
        id: 'hm_speed_bot',
        name: 'HM SPEED BOT',
        xml: HMSpeedBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    auto_c4_voltai_premium: {
        id: 'auto_c4_voltai_premium',
        name: 'AUTO C4 VOLTAI PREMIUM',
        xml: AutoC4VoltaiPremiumRobot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    ai_under_recovery: {
        id: 'ai_under_recovery',
        name: 'AI UNDER RECOVERY BOT',
        xml: AIUnderRecoveryBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    algo_sniper: {
        id: 'algo_sniper',
        name: 'ALGO SNIPER',
        xml: AlgoSniper,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    bram_even_odd_printer: {
        id: 'bram_even_odd_printer',
        name: 'BRAM EVEN ODD PRINTER',
        xml: BRAMEvenOddPrinter,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    bram_speed_bot: {
        id: 'bram_speed_bot',
        name: 'BRAM SPEED BOT',
        xml: BRAMSpeedBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    candle_mine_v2: {
        id: 'candle_mine_v2',
        name: 'CANDLE MINE V2',
        xml: CandleMineV2,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    deriv_wizard: {
        id: 'deriv_wizard',
        name: 'DERIV WIZARD',
        xml: DerivWizard,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    double_over_analysis: {
        id: 'double_over_analysis',
        name: 'DOUBLE OVER WITH ANALYSIS',
        xml: DoubleOverWithAnalysis,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    enhanced_digit_switcher: {
        id: 'enhanced_digit_switcher',
        name: 'ENHANCED DIGIT SWITCHER V5',
        xml: EnhancedDigitSwitcherV5,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    expert_speed_bot: {
        id: 'expert_speed_bot',
        name: 'EXPERT SPEED BOT',
        xml: ExpertSpeedBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    expert_speed_chosen_dollar: {
        id: 'expert_speed_chosen_dollar',
        name: 'EXPERT SPEED BOT BY CHOSEN DOLLAR',
        xml: ExpertSpeedBotByChosenDollar,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    master_bot_v6: {
        id: 'master_bot_v6',
        name: 'MASTER BOT V6 UPGRADED',
        xml: MasterBotV6,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    market_killer: {
        id: 'market_killer',
        name: 'MARKET KILLER',
        xml: MarketKiller,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    mr_duke_v2: {
        id: 'mr_duke_v2',
        name: 'MR DUKE V2 BOT',
        xml: MrDukeV2Bot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    over_destroyer_mike_g: {
        id: 'over_destroyer_mike_g',
        name: 'OVER DESTROYER BY MIKE G',
        xml: OverDestroyerByMikeG,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    over_destroyer_state_fx: {
        id: 'over_destroyer_state_fx',
        name: 'OVER DESTROYER BY STATE FX',
        xml: OverDestroyerByStateFX,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    profit_gainer_xvt: {
        id: 'profit_gainer_xvt',
        name: 'PROFIT GAINER XVT',
        xml: ProfitGainerXVT,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    profit_gainer_xvt_setup: {
        id: 'profit_gainer_xvt_setup',
        name: 'PROFIT GAINER XVT SETUP',
        xml: ProfitGainerXVTSetup,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    states_digit_switcher: {
        id: 'states_digit_switcher',
        name: 'STATES DIGIT SWITCHER V2',
        xml: StatesDigitSwitcherV2,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    signal_sniper_auto: {
        id: 'signal_sniper_auto',
        name: 'SIGNAL SNIPER AUTO BOT',
        xml: SignalSniperAutoBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    v6_striker_bot: {
        id: 'v6_striker_bot',
        name: 'V6 STRIKER BOT',
        xml: V6StrikerBot,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    master_g8_over_under: {
        id: 'master_g8_over_under',
        name: 'MASTER G8 OVER UNDER BY STATE FX',
        xml: MasterG8OverUnder,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
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