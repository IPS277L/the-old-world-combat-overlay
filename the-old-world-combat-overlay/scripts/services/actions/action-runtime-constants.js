const TOW_ACTIONS_KEY = "towActions";
const TOW_ACTIONS_VERSION = "1.0.0";
const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
const DEFAULT_DEFENCE_SKILL = "defence";
const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };
const ATTACK_CALL_DEDUPE_MS = 700;
const DAMAGE_RENDER_DEDUPE_MS = 120000;
