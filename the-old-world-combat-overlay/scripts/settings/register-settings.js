function getTowCombatOverlaySetting(settingKey, fallbackValue = null) {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  try {
    return game.settings.get(moduleId, settingKey);
  } catch (_error) {
    return fallbackValue;
  }
}

function isTowCombatOverlaySettingEnabled(settingKey, fallbackValue = false) {
  return !!getTowCombatOverlaySetting(settingKey, fallbackValue);
}

function shouldTowCombatOverlayAutoSubmitDialogs() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableDialogAutoSubmit, true);
}

function shouldTowCombatOverlayAutoDefence() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoDefence, true);
}

function shouldTowCombatOverlayAutoApplyDamage() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableAutoApplyDamage, true);
}

function shouldTowCombatOverlayAutoChooseStaggerWound() {
  const { settings } = getTowCombatOverlayModuleConstants();
  return isTowCombatOverlaySettingEnabled(settings.enableStaggerChoiceAutomation, true);
}

function registerTowCombatOverlaySettings() {
  const { moduleId, settings: settingKeys } = getTowCombatOverlayModuleConstants();
  const settings = [
    {
      key: settingKeys.enableOverlay,
      name: "Enable Overlay",
      hint: "Enables The Old World Combat Overlay token UI.",
      default: true,
      onChange: () => {
        if (typeof globalThis.syncTowCombatOverlayEnabledSetting === "function") {
          globalThis.syncTowCombatOverlayEnabledSetting();
        }
      }
    },
    {
      key: settingKeys.enableAutoDefence,
      name: "Enable Auto-Defence",
      hint: "Automatically trigger defender rolls during opposed attack flow.",
      default: true
    },
    {
      key: settingKeys.enableAutoApplyDamage,
      name: "Enable Auto-Apply Damage",
      hint: "Automatically apply computed opposed damage when possible.",
      default: true
    },
    {
      key: settingKeys.enableStaggerChoiceAutomation,
      name: "Enable Stagger Automation",
      hint: "Automatically choose the wound option for stagger prompts during automation.",
      default: true
    },
    {
      key: settingKeys.enableDialogAutoSubmit,
      name: "Enable Dialog Auto-Submit",
      hint: "Automatically submit attack, defence, and casting dialogs during fast roll flows.",
      default: true
    }
  ];

  for (const setting of settings) {
    game.settings.register(moduleId, setting.key, {
      scope: "world",
      config: true,
      type: Boolean,
      default: setting.default,
      name: setting.name,
      hint: setting.hint,
      onChange: setting.onChange
    });
  }
}
