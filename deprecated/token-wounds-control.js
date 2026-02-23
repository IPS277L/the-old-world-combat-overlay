// Toggle wound controls on tokens (Foundry V13)
// Displays wound count to the right side of each token with clickable + / - buttons.

const MODULE_KEY = "towMacroWoundControls";
const UI_KEY = "_towWoundControlUI";
const PreciseTextClass = foundry.canvas.containers.PreciseText;

function getWoundCount(tokenDocument) {
  const actor = tokenDocument?.actor;
  if (!actor) return null;
  if (Array.isArray(actor.itemTypes?.wound)) return actor.itemTypes.wound.length;
  return actor.items.filter((i) => i.type === "wound").length;
}

function canEditActor(actor) {
  return actor?.isOwner === true;
}

async function addWound(actor) {
  if (!canEditActor(actor)) {
    ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
    return;
  }

  await actor.createEmbeddedDocuments("Item", [{ type: "wound", name: "Wound" }]);
}

async function removeWound(actor) {
  if (!canEditActor(actor)) {
    ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
    return;
  }

  const wounds = (actor.itemTypes?.wound ?? actor.items.filter((i) => i.type === "wound"));
  if (!wounds.length) return;

  const toDelete = wounds.find((w) => w.system?.treated !== true) ?? wounds[wounds.length - 1];
  if (!toDelete) return;

  await actor.deleteEmbeddedDocuments("Item", [toDelete.id]);
}

async function toggleStaggered(actor) {
  if (!canEditActor(actor)) {
    ui.notifications.warn(`No permission to edit ${actor?.name ?? "actor"}.`);
    return;
  }

  const hasStaggered = !!actor.hasCondition?.("staggered");
  if (hasStaggered) {
    await actor.removeCondition("staggered");
  } else {
    await actor.addCondition("staggered");
  }
}

function baseStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontSize = 22;
  style.fill = "#f5e8c8";
  style.stroke = "#111111";
  style.strokeThickness = 4;
  style.dropShadow = false;
  style.align = "left";
  return style;
}

function createControlUI(tokenObject) {
  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;
  container._tokenObject = tokenObject;

  const countText = new PreciseTextClass("", baseStyle());
  countText.anchor.set(0, 0.5);
  countText.eventMode = "none";

  // Dedicated click target is more reliable than text hit-testing on canvas.
  const hitBox = new PIXI.Graphics();
  hitBox.eventMode = "static";
  hitBox.interactive = true;
  hitBox.buttonMode = true;
  hitBox.cursor = "pointer";

  const getMouseButton = (ev) => {
    return ev.button ?? ev.data?.button ?? ev.nativeEvent?.button ?? 0;
  };

  const onCountPointerDown = async (ev) => {
    ev.stopPropagation();
    ev.nativeEvent?.preventDefault?.();
    const actor = tokenObject.document.actor;
    if (!actor) return;

    const button = getMouseButton(ev);

    if (button === 2) {
      await removeWound(actor);
      return;
    }

    if (button === 0) {
      await addWound(actor);
    }
  };

  const onCountRightClick = async (ev) => {
    ev.stopPropagation();
    ev.nativeEvent?.preventDefault?.();
    const actor = tokenObject.document.actor;
    if (!actor) return;
    await removeWound(actor);
  };

  // Use a single pointer event path to avoid duplicate triggers.
  hitBox.on("pointerdown", onCountPointerDown);
  hitBox.on("contextmenu", (ev) => {
    ev.stopPropagation();
    ev.nativeEvent?.preventDefault?.();
  });

  const stagText = new PreciseTextClass("STAG", baseStyle());
  stagText.anchor.set(0, 0.5);
  stagText.eventMode = "none";

  const stagHitBox = new PIXI.Graphics();
  stagHitBox.eventMode = "static";
  stagHitBox.interactive = true;
  stagHitBox.buttonMode = true;
  stagHitBox.cursor = "pointer";

  const onStagPointerDown = async (ev) => {
    ev.stopPropagation();
    ev.nativeEvent?.preventDefault?.();
    const actor = tokenObject.document.actor;
    if (!actor) return;
    await toggleStaggered(actor);
  };

  stagHitBox.on("pointerdown", onStagPointerDown);
  stagHitBox.on("contextmenu", (ev) => {
    ev.stopPropagation();
    ev.nativeEvent?.preventDefault?.();
  });

  container.addChild(hitBox);
  container.addChild(countText);
  container.addChild(stagHitBox);
  container.addChild(stagText);

  container._hitBox = hitBox;
  container._countText = countText;
  container._stagHitBox = stagHitBox;
  container._stagText = stagText;

  canvas.tokens.addChild(container);
  tokenObject[UI_KEY] = container;

  return container;
}

function updateControlUI(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const count = getWoundCount(tokenObject.document);
  if (count === null || count === undefined) {
    const ui = tokenObject[UI_KEY];
    if (ui) {
      ui.parent?.removeChild(ui);
      ui.destroy({ children: true });
      delete tokenObject[UI_KEY];
    }
    return;
  }

  const ui = tokenObject[UI_KEY] ?? createControlUI(tokenObject);
  const countText = ui._countText;
  const hitBox = ui._hitBox;
  const stagText = ui._stagText;
  const stagHitBox = ui._stagHitBox;
  const actor = tokenObject.document.actor;
  const hasStaggered = !!actor?.hasCondition?.("staggered");

  countText.text = `W:${count}`;
  stagText.text = "STAG";
  const padX = 5;
  const padY = 3;
  const rowGap = Math.max(18, countText.height + 4);
  const topY = -rowGap / 2;
  const bottomY = topY + rowGap;
  const hitX = -padX;
  const hitY = topY - (countText.height / 2) - padY;
  const hitW = countText.width + (padX * 2);
  const hitH = countText.height + (padY * 2);
  hitBox.clear();
  hitBox.beginFill(0x000000, 0.001);
  hitBox.drawRoundedRect(hitX, hitY, hitW, hitH, 6);
  hitBox.endFill();

  const stagX = 0;
  const stagHitX = stagX - padX;
  const stagHitY = bottomY - (stagText.height / 2) - padY;
  const stagHitW = stagText.width + (padX * 2);
  const stagHitH = stagText.height + (padY * 2);
  stagHitBox.clear();
  stagHitBox.beginFill(0x000000, 0.001);
  stagHitBox.drawRoundedRect(stagHitX, stagHitY, stagHitW, stagHitH, 6);
  stagHitBox.endFill();

  const x = tokenObject.x + tokenObject.w + 6;
  const y = tokenObject.y + tokenObject.h / 2;
  ui.position.set(x, y);
  countText.position.set(0, topY);
  stagText.position.set(stagX, bottomY);

  const editable = canEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  stagText.alpha = editable ? 1 : 0.45;
  stagText.style.fill = hasStaggered ? "#f5e8c8" : "#9f9f9f";

  ui.visible = tokenObject.visible;
}

function refreshAllControlUI() {
  for (const token of canvas.tokens.placeables) {
    updateControlUI(token);
  }
}

function clearAllControlUI() {
  for (const token of canvas.tokens.placeables) {
    const ui = token[UI_KEY];
    if (!ui) continue;
    ui.parent?.removeChild(ui);
    ui.destroy({ children: true });
    delete token[UI_KEY];
  }
}

function refreshActorTokenControls(actor) {
  if (!actor) return;
  for (const token of actor.getActiveTokens(true)) {
    updateControlUI(token.object ?? token);
  }
}

if (!game[MODULE_KEY]) {
  const hookIds = {
    canvasReady: Hooks.on("canvasReady", () => refreshAllControlUI()),
    refreshToken: Hooks.on("refreshToken", (token) => updateControlUI(token)),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type === "wound") refreshAllControlUI();
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type === "wound") refreshAllControlUI();
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type === "wound") refreshAllControlUI();
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => refreshActorTokenControls(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => refreshActorTokenControls(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => refreshActorTokenControls(effect?.parent))
  };

  game[MODULE_KEY] = hookIds;
  refreshAllControlUI();
  ui.notifications.info("Wound controls enabled. Left click W to add, right click W to remove.");
} else {
  const hookIds = game[MODULE_KEY];
  Hooks.off("canvasReady", hookIds.canvasReady);
  Hooks.off("refreshToken", hookIds.refreshToken);
  Hooks.off("createItem", hookIds.createItem);
  Hooks.off("deleteItem", hookIds.deleteItem);
  Hooks.off("updateItem", hookIds.updateItem);
  Hooks.off("createActiveEffect", hookIds.createActiveEffect);
  Hooks.off("updateActiveEffect", hookIds.updateActiveEffect);
  Hooks.off("deleteActiveEffect", hookIds.deleteActiveEffect);

  delete game[MODULE_KEY];
  clearAllControlUI();
  ui.notifications.info("Wound controls disabled.");
}
