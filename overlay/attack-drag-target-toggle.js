// Toggle ATK drag-to-target quick attack (test macro, isolated from overlay-toggle)
// Drag from source token's ATK label and release over another token to quick-roll first attack.

const MODULE_KEY = "towAtkDragTargetToggle";
const UI_KEY = "_towAtkDragUi";
const LIB_MACRO_CANDIDATES = ["tow-actions-lib-v1", "tow-actions-lib"];
const PreciseTextClass = foundry.canvas.containers.PreciseText;

function getLabelStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontSize = 22;
  style.fill = "#f5e8c8";
  style.stroke = "#111111";
  style.strokeThickness = 4;
  style.dropShadow = false;
  style.align = "right";
  return style;
}

async function ensureTowActions() {
  const hasApi = typeof game.towActions?.attackActor === "function";
  if (hasApi) return true;

  const libMacro = LIB_MACRO_CANDIDATES.map((name) => game.macros.getName(name)).find(Boolean);
  if (!libMacro) {
    ui.notifications.error(`Shared actions macro not found. Tried: ${LIB_MACRO_CANDIDATES.join(", ")}`);
    return false;
  }

  try {
    await libMacro.execute();
  } catch (error) {
    console.error("[attack-drag-target-toggle] Failed to execute shared actions macro.", error);
    ui.notifications.error("Failed to load shared actions macro.");
    return false;
  }

  return typeof game.towActions?.attackActor === "function";
}

function getWorldPoint(event) {
  const global = event?.global ?? event?.data?.global;
  if (global && canvas?.stage?.worldTransform) {
    return canvas.stage.worldTransform.applyInverse(global);
  }
  return canvas.mousePosition ?? null;
}

function tokenAtPoint(point, { excludeTokenId } = {}) {
  if (!point) return null;
  const placeables = [...canvas.tokens.placeables];
  for (let i = placeables.length - 1; i >= 0; i--) {
    const token = placeables[i];
    if (!token || token.destroyed || !token.visible) continue;
    if (token.id === excludeTokenId) continue;
    if (point.x >= token.x && point.x <= token.x + token.w && point.y >= token.y && point.y <= token.y + token.h) {
      return token;
    }
  }
  return null;
}

function setSingleTarget(token) {
  if (!token) return;
  if (typeof game.user.updateTokenTargets === "function") {
    game.user.updateTokenTargets([token.id]);
    return;
  }

  for (const target of Array.from(game.user.targets ?? [])) {
    target.setTarget(false, { releaseOthers: false, groupSelection: false });
  }
  token.setTarget(true, { releaseOthers: true, groupSelection: false });
}

function createAtkUi(tokenObject) {
  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;

  const text = new PreciseTextClass("ATK", getLabelStyle());
  text.anchor.set(1, 0.5);
  text.eventMode = "none";

  const hitBox = new PIXI.Graphics();
  hitBox.eventMode = "static";
  hitBox.interactive = true;
  hitBox.buttonMode = true;
  hitBox.cursor = "grab";

  hitBox.on("pointerdown", (event) => {
    if ((event.button ?? event.data?.button ?? event.nativeEvent?.button ?? 0) !== 0) return;
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();

    hitBox.cursor = "grabbing";
    const sourceToken = tokenObject;

    const finishDrag = async (upEvent) => {
      hitBox.cursor = "grab";
      const point = getWorldPoint(upEvent);
      const target = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!target) return;

      const ready = await ensureTowActions();
      if (!ready) return;

      setSingleTarget(target);
      await game.towActions.attackActor(sourceToken.actor, { manual: false });
    };

    canvas.stage.once("pointerup", finishDrag);
    canvas.stage.once("pointerupoutside", finishDrag);
  });

  hitBox.on("contextmenu", (event) => {
    event.stopPropagation();
    event.nativeEvent?.preventDefault?.();
  });

  container.addChild(hitBox);
  container.addChild(text);
  container._text = text;
  container._hitBox = hitBox;

  canvas.tokens.addChild(container);
  tokenObject[UI_KEY] = container;
  return container;
}

function updateAtkUi(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;
  const ui = tokenObject[UI_KEY] ?? createAtkUi(tokenObject);
  const text = ui._text;
  const hitBox = ui._hitBox;

  const padX = 6;
  const padY = 4;
  const x = tokenObject.x - 10;
  const y = tokenObject.y + tokenObject.h / 2;
  const textY = 0;

  ui.position.set(x, y);
  text.position.set(0, textY);

  const width = text.width + padX * 2;
  const height = text.height + padY * 2;
  hitBox.clear();
  hitBox.beginFill(0x000000, 0.001);
  hitBox.drawRoundedRect(-width, textY - (text.height / 2) - padY, width, height, 6);
  hitBox.endFill();

  ui.visible = tokenObject.visible;
}

function clearAllUi() {
  for (const token of canvas.tokens.placeables) {
    const ui = token[UI_KEY];
    if (!ui) continue;
    ui.parent?.removeChild(ui);
    ui.destroy({ children: true });
    delete token[UI_KEY];
  }
}

function refreshAll() {
  for (const token of canvas.tokens.placeables) {
    updateAtkUi(token);
  }
}

if (!game[MODULE_KEY]) {
  const hooks = {
    canvasReady: Hooks.on("canvasReady", refreshAll),
    refreshToken: Hooks.on("refreshToken", (token) => updateAtkUi(token))
  };
  game[MODULE_KEY] = hooks;
  refreshAll();
  ui.notifications.info("ATK drag-to-target enabled (test). Drag ATK to another token and release.");
} else {
  const hooks = game[MODULE_KEY];
  Hooks.off("canvasReady", hooks.canvasReady);
  Hooks.off("refreshToken", hooks.refreshToken);
  delete game[MODULE_KEY];
  clearAllUi();
  ui.notifications.info("ATK drag-to-target disabled.");
}
