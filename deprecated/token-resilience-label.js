// Toggle Resilience labels above tokens (Foundry V13)
// Reads actor.system.resilience.value and shows "RES X" above each token.

const MODULE_KEY = "towMacroResilienceLabels";
const LABEL_KEY = "_towResilienceLabel";
const PreciseTextClass = foundry.canvas.containers.PreciseText;

function getResilienceValue(tokenDocument) {
  return tokenDocument?.actor?.system?.resilience?.value ?? null;
}

function getLabelStyle() {
  const base = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  base.fontSize = 32;
  base.fill = "#f5e8c8";
  base.stroke = "#1a1a1a";
  base.strokeThickness = 4;
  base.align = "center";
  return base;
}

function updateTokenLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const resilience = getResilienceValue(tokenObject.document);
  if (resilience === null || resilience === undefined) {
    if (tokenObject[LABEL_KEY]) {
      tokenObject.removeChild(tokenObject[LABEL_KEY]);
      tokenObject[LABEL_KEY].destroy();
      delete tokenObject[LABEL_KEY];
    }
    return;
  }

  let label = tokenObject[LABEL_KEY];
  if (!label) {
    label = new PreciseTextClass("", getLabelStyle());
    label.anchor.set(0.5, 1);
    tokenObject.addChild(label);
    tokenObject[LABEL_KEY] = label;
  }

  label.text = `RES ${resilience}`;
  label.position.set(tokenObject.w / 2, -2);
  label.visible = tokenObject.visible;
}

function clearAllLabels() {
  for (const token of canvas.tokens.placeables) {
    const label = token[LABEL_KEY];
    if (!label) continue;
    token.removeChild(label);
    label.destroy();
    delete token[LABEL_KEY];
  }
}

function refreshAllLabels() {
  for (const token of canvas.tokens.placeables) {
    updateTokenLabel(token);
  }
}

if (!game[MODULE_KEY]) {
  const refreshHookId = Hooks.on("refreshToken", (token) => updateTokenLabel(token));
  const drawHookId = Hooks.on("canvasReady", () => refreshAllLabels());

  game[MODULE_KEY] = {
    refreshHookId,
    drawHookId
  };

  refreshAllLabels();
  ui.notifications.info("Resilience labels enabled.");
} else {
  Hooks.off("refreshToken", game[MODULE_KEY].refreshHookId);
  Hooks.off("canvasReady", game[MODULE_KEY].drawHookId);
  delete game[MODULE_KEY];

  clearAllLabels();
  ui.notifications.info("Resilience labels disabled.");
}
