function getControlStyle() {
  const style = CONFIG.canvasTextStyle?.clone?.() ?? new PIXI.TextStyle();
  style.fontFamily = "CaslonPro";
  style.fontWeight = "700";
  style.fontSize = OVERLAY_FONT_SIZE;
  style.fill = "#FFF4D8";
  style.stroke = "rgba(5, 5, 5, 0.76)";
  style.strokeThickness = 2;
  style.lineJoin = "round";
  style.miterLimit = 2;
  style.dropShadow = false;
  style.align = "left";
  return style;
}

function getNameStyle() {
  const style = getControlStyle();
  style.align = "center";
  return style;
}

function getNameTypeStyle() {
  const style = getControlStyle();
  style.align = "center";
  return style;
}

function getIconValueStyle() {
  const style = getControlStyle();
  style.fontWeight = "700";
  return style;
}

function createOverlayIconSprite(src, size = OVERLAY_FONT_SIZE + 2) {
  const OutlineFilterClass = PIXI?.filters?.OutlineFilter ?? PIXI?.OutlineFilter;
  if (typeof OutlineFilterClass === "function") {
    const sprite = PIXI.Sprite.from(src);
    sprite.width = size;
    sprite.height = size;
    sprite.tint = OVERLAY_CONTROL_ICON_TINT;
    sprite.alpha = 0.98;
    const outline = new OutlineFilterClass(
      OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS,
      OVERLAY_CONTROL_ICON_OUTLINE_COLOR,
      1
    );
    if ("alpha" in outline) outline.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    sprite.filters = [outline];
    sprite.eventMode = "none";
    return sprite;
  }

  // Runtime-safe fallback when OutlineFilter is unavailable: fake stroke with offset clones.
  const container = new PIXI.Container();
  container.eventMode = "none";
  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],            [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  for (const [dx, dy] of offsets) {
    const strokeSprite = PIXI.Sprite.from(src);
    strokeSprite.width = size;
    strokeSprite.height = size;
    strokeSprite.tint = OVERLAY_CONTROL_ICON_OUTLINE_COLOR;
    strokeSprite.alpha = OVERLAY_CONTROL_ICON_OUTLINE_ALPHA;
    strokeSprite.position.set(dx, dy);
    strokeSprite.eventMode = "none";
    container.addChild(strokeSprite);
  }

  const sprite = PIXI.Sprite.from(src);
  sprite.width = size;
  sprite.height = size;
  sprite.tint = OVERLAY_CONTROL_ICON_TINT;
  sprite.alpha = 0.98;
  sprite.eventMode = "none";
  container.addChild(sprite);
  return container;
}

function getActorTypeLabel(actor) {
  const systemType = String(actor?.system?.type ?? "").trim();
  if (systemType) return systemType;
  const actorType = String(actor?.type ?? "").trim();
  if (actorType) return actorType;
  return "actor";
}

function tuneOverlayText(textObject) {
  if (!textObject) return;
  textObject.roundPixels = true;
  const devicePixelRatio = Math.max(1, Number(window.devicePixelRatio ?? 1));
  const canvasScale = Number(canvas?.stage?.scale?.x ?? 1);
  const zoom = (Number.isFinite(canvasScale) && canvasScale > 0) ? canvasScale : 1;
  const zoomBoost = zoom < 1 ? (1 / zoom) : 1;
  const resolution = Math.min(
    OVERLAY_TEXT_RESOLUTION_MAX,
    Math.max(OVERLAY_TEXT_RESOLUTION_MIN, Math.ceil(devicePixelRatio * zoomBoost))
  );
  if ("resolution" in textObject && textObject.resolution !== resolution) {
    textObject.resolution = resolution;
    textObject.dirty = true;
  }
}

function drawHitBoxRect(graphics, x, y, width, height) {
  graphics.clear();
  graphics.beginFill(0x000000, 0.001);
  graphics.drawRoundedRect(x, y, width, height, 6);
  graphics.endFill();
}

function createWoundControlUI(tokenObject) {
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.woundUiMarker] === true && child?.[KEYS.woundUiTokenId] === tokenObject.id) {
      clearDisplayObject(child);
    }
  }

  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;
  container[KEYS.woundUiMarker] = true;
  container[KEYS.woundUiTokenId] = tokenObject.id;

  const countText = new PreciseTextClass("", getIconValueStyle());
  tuneOverlayText(countText);
  countText.anchor.set(0, 0.5);
  countText.eventMode = "none";
  const countIcon = createOverlayIconSprite(ICON_SRC_WOUND, OVERLAY_FONT_SIZE + 1);

  const countHitBox = new PIXI.Graphics();
  countHitBox.eventMode = "static";
  countHitBox.interactive = true;
  countHitBox.buttonMode = true;
  countHitBox.cursor = "pointer";

  const attackIcon = createOverlayIconSprite(ICON_SRC_ATK, OVERLAY_FONT_SIZE + 2);

  const defenceIcon = createOverlayIconSprite(ICON_SRC_DEF, OVERLAY_FONT_SIZE + 2);

  const attackHitBox = new PIXI.Graphics();
  attackHitBox.eventMode = "static";
  attackHitBox.interactive = true;
  attackHitBox.buttonMode = true;
  attackHitBox.cursor = "grab";

  const defenceHitBox = new PIXI.Graphics();
  defenceHitBox.eventMode = "static";
  defenceHitBox.interactive = true;
  defenceHitBox.buttonMode = true;
  defenceHitBox.cursor = "pointer";

  countHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;

    if (getMouseButton(event) !== 0) {
      return;
    }
    await addWound(actor);
  });
  countHitBox.on("rightdown", async (event) => {
    preventPointerDefault(event);
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    await removeWound(actor);
  });
  countHitBox.on("contextmenu", preventPointerDefault);
  bindTooltipHandlers(countHitBox, () => ({
    title: "Wounds",
    description: "Left-click adds 1 wound. Right-click removes 1 wound."
  }));

  attackHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    if (getMouseButton(event) !== 0) return;

    const sourceToken = tokenObject;
    const sourceActor = getActorFromToken(sourceToken);
    if (!sourceActor) return;
    if (!(await ensureTowActions())) return;

    const pointerDownShift = isShiftModifier(event);
    const origin = {
      x: sourceToken.x + (sourceToken.w / 2),
      y: sourceToken.y + (sourceToken.h / 2)
    };
    const startPoint = getWorldPoint(event) ?? origin;
    let dragStarted = false;
    let dragFinished = false;
    let dragLine = null;
    attackHitBox.cursor = "grabbing";

    const cleanupDrag = () => {
      canvas.stage.off("pointermove", onDragMove);
      canvas.stage.off("pointerup", finishDrag);
      canvas.stage.off("pointerupoutside", finishDrag);
      clearDragLine(dragLine);
      dragLine = null;
      attackHitBox.cursor = "grab";
    };

    const onDragMove = (moveEvent) => {
      const point = getWorldPoint(moveEvent);
      if (!point) return;
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      if (!dragStarted) {
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
        dragStarted = true;
        dragLine = createDragLine();
      }
      drawDragLine(dragLine, origin, point);
    };

    const finishDrag = async (upEvent) => {
      if (dragFinished) return;
      dragFinished = true;
      cleanupDrag();

      const shiftManual = pointerDownShift || isShiftModifier(upEvent);
      if (!dragStarted) {
        await game.towActions.attackActor(sourceActor, { manual: shiftManual });
        return;
      }

      const point = getWorldPoint(upEvent);
      const target = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!target) return;
      if (!shouldRunDragAttack(sourceToken, target)) return;

      setSingleTarget(target);
      if (shiftManual) {
        await game.towActions.attackActor(sourceActor, { manual: true });
        return;
      }

      const sourceBeforeState = snapshotActorState(sourceActor);
      const restoreStaggerPrompt = armDefaultStaggerChoiceWound(AUTO_STAGGER_PATCH_MS);
      armAutoDefenceForOpposed(sourceToken, target, { sourceBeforeState });
      try {
        await game.towActions.attackActor(sourceActor, { manual: false });
      } finally {
        setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
      }
    };

    canvas.stage.on("pointermove", onDragMove);
    canvas.stage.on("pointerup", finishDrag);
    canvas.stage.on("pointerupoutside", finishDrag);
  });
  attackHitBox.on("contextmenu", preventPointerDefault);
  bindTooltipHandlers(attackHitBox, () => ({
    title: "Attack",
    description: "Attack roll. Left-click attacks. Drag to a target for quick targeting. Hold Shift for manual mode."
  }));

  defenceHitBox.on("pointerdown", async (event) => {
    preventPointerDefault(event);
    if (getMouseButton(event) !== 0) return;
    const actor = getActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await ensureTowActions())) return;
    await game.towActions.defenceActor(actor, { manual: game.towActions.isShiftHeld() });
  });
  defenceHitBox.on("contextmenu", preventPointerDefault);
  bindTooltipHandlers(defenceHitBox, () => ({
    title: "Defence",
    description: "Defence roll. Left-click defends. Hold Shift for manual mode."
  }));

  container.addChild(countHitBox);
  container.addChild(countIcon);
  container.addChild(countText);
  container.addChild(attackHitBox);
  container.addChild(defenceHitBox);
  container.addChild(attackIcon);
  container.addChild(defenceIcon);

  container._countText = countText;
  container._countIcon = countIcon;
  container._countHitBox = countHitBox;
  container._attackHitBox = attackHitBox;
  container._defenceHitBox = defenceHitBox;
  container._attackIcon = attackIcon;
  container._defenceIcon = defenceIcon;

  tokenObject.addChild(container);
  tokenObject[KEYS.woundUI] = container;
  return container;
}

function updateWoundControlUI(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const count = getWoundCount(tokenObject.document);
  if (count === null || count === undefined) {
    const ui = tokenObject[KEYS.woundUI];
    if (!ui) return;
    clearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return;
  }

  const existingUi = tokenObject[KEYS.woundUI];
  const hasBrokenTextStyle = !!existingUi && (
    !existingUi._countText ||
    !existingUi._countIcon ||
    !existingUi._attackIcon ||
    !existingUi._defenceIcon ||
    existingUi._countText.destroyed ||
    existingUi._countIcon.destroyed ||
    existingUi._attackIcon.destroyed ||
    existingUi._defenceIcon.destroyed ||
    !existingUi._countText.style
  );
  const staleUi = !!existingUi && (
    existingUi.destroyed ||
    existingUi.parent == null ||
    existingUi.parent !== tokenObject ||
    hasBrokenTextStyle ||
    existingUi._attackHitBox?.destroyed ||
    existingUi._defenceHitBox?.destroyed ||
    existingUi._countHitBox?.destroyed
  );
  if (staleUi) {
    clearDisplayObject(existingUi);
    delete tokenObject[KEYS.woundUI];
  }

  const ui = (!tokenObject[KEYS.woundUI] || tokenObject[KEYS.woundUI].destroyed)
    ? createWoundControlUI(tokenObject)
    : tokenObject[KEYS.woundUI];
  const actor = getActorFromToken(tokenObject);

  const countText = ui._countText;
  const countIcon = ui._countIcon;
  const countHitBox = ui._countHitBox;
  const attackHitBox = ui._attackHitBox;
  const defenceHitBox = ui._defenceHitBox;
  const attackIcon = ui._attackIcon;
  const defenceIcon = ui._defenceIcon;
  tuneOverlayText(countText);

  try {
    countText.text = `${count}`;
  } catch (_error) {
    clearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return updateWoundControlUI(tokenObject);
  }

  const padX = 3;
  const padY = 2;
  const rowGap = Math.max(18, countText.height + 4);
  const centerY = 0;
  const rightBottomY = centerY + (rowGap / 2);
  const leftTopY = -(rowGap / 2);
  const leftBottomY = leftTopY + rowGap;

  const countGap = 4;
  countIcon.position.set(0, Math.round(rightBottomY - (countIcon.height / 2)));
  countText.position.set(Math.round(countIcon.width + countGap), Math.round(rightBottomY));
  const countBlockWidth = countIcon.width + countGap + countText.width;
  const countBlockHeight = Math.max(countIcon.height, countText.height);
  drawHitBoxRect(
    countHitBox,
    -padX,
    rightBottomY - (countBlockHeight / 2) - padY,
    countBlockWidth + (padX * 2),
    countBlockHeight + (padY * 2)
  );

  ui.position.set(Math.round(tokenObject.w + TOKEN_CONTROL_PAD), Math.round(tokenObject.h / 2));

  const leftX = -(tokenObject.w + (TOKEN_CONTROL_PAD * 2));
  attackIcon.position.set(
    Math.round(leftX - attackIcon.width),
    Math.round(leftTopY - (attackIcon.height / 2))
  );
  defenceIcon.position.set(
    Math.round(leftX - defenceIcon.width),
    Math.round(leftBottomY - (defenceIcon.height / 2))
  );

  drawHitBoxRect(
    attackHitBox,
    attackIcon.x - padX,
    attackIcon.y - padY,
    attackIcon.width + (padX * 2),
    attackIcon.height + (padY * 2)
  );
  drawHitBoxRect(
    defenceHitBox,
    defenceIcon.x - padX,
    defenceIcon.y - padY,
    defenceIcon.width + (padX * 2),
    defenceIcon.height + (padY * 2)
  );

  const editable = canEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  countIcon.alpha = editable ? 1 : 0.45;
  attackIcon.alpha = 1;
  defenceIcon.alpha = 1;
  ui.visible = tokenObject.visible;
}

function clearAllWoundControls() {
  forEachSceneToken((token) => {
    const ui = token[KEYS.woundUI];
    if (!ui) return;
    clearDisplayObject(ui);
    delete token[KEYS.woundUI];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    const marked = child?.[KEYS.woundUiMarker] === true;
    const legacyLikelyWoundUi = child?._countText && child?._attackText && child?._defenceText;
    if (marked || legacyLikelyWoundUi) orphaned.push(child);
  }
  for (const ui of orphaned) clearDisplayObject(ui);
}

function updateNameLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const tokenName = tokenObject.document?.name ?? tokenObject.name ?? "";
  const actor = tokenObject.document?.actor ?? null;
  const typeLabel = getActorTypeLabel(actor).toLowerCase();
  if (!tokenName) {
    const labelContainer = tokenObject[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete tokenObject[KEYS.nameLabel];
    return;
  }

  let labelContainer = tokenObject[KEYS.nameLabel];
  if (!labelContainer || labelContainer.destroyed || labelContainer.parent !== tokenObject || !labelContainer._nameText || !labelContainer._typeText) {
    if (labelContainer && !labelContainer.destroyed) {
      labelContainer.parent?.removeChild(labelContainer);
      labelContainer.destroy({ children: true });
    }

    labelContainer = new PIXI.Container();
    labelContainer.eventMode = "static";
    labelContainer.interactive = true;
    labelContainer.cursor = "help";

    const nameText = new PreciseTextClass("", getNameStyle());
    tuneOverlayText(nameText);
    nameText.anchor.set(0.5, 1);
    nameText.eventMode = "none";

    const typeText = new PreciseTextClass("", getNameTypeStyle());
    tuneOverlayText(typeText);
    typeText.anchor.set(0.5, 1);
    typeText.eventMode = "none";

    labelContainer.addChild(nameText);
    labelContainer.addChild(typeText);
    labelContainer._nameText = nameText;
    labelContainer._typeText = typeText;
    labelContainer[KEYS.nameLabelMarker] = true;
    labelContainer[KEYS.nameLabelTokenId] = tokenObject.id;

    tokenObject.addChild(labelContainer);
    tokenObject[KEYS.nameLabel] = labelContainer;
  }

  const nameText = labelContainer._nameText;
  const typeText = labelContainer._typeText;
  tuneOverlayText(nameText);
  tuneOverlayText(typeText);
  if (!labelContainer._towTypeTooltipBound) {
    labelContainer._towTypeTooltipBound = bindTooltipHandlers(labelContainer, () => getTypeTooltipData(actor));
  }
  nameText.text = tokenName;
  typeText.text = `<${typeLabel}>`;
  const tokenEdgePad = TOKEN_CONTROL_PAD;
  const lineGap = 0;
  const typeBounds = typeText.getLocalBounds();
  const typeBottom = typeBounds.y + typeBounds.height;
  const typeTop = typeBounds.y;
  typeText.position.set(0, Math.round(-(tokenEdgePad + typeBottom) + NAME_TYPE_TO_TOKEN_OFFSET_PX));

  const nameBounds = nameText.getLocalBounds();
  const nameBottom = nameBounds.y + nameBounds.height;
  nameText.position.set(0, Math.round((typeText.y + typeTop) + NAME_TYPE_STACK_OVERLAP_PX - lineGap - nameBottom));
  const combinedMinX = Math.min(nameBounds.x, typeBounds.x);
  const combinedMinY = Math.min(nameText.y + nameBounds.y, typeText.y + typeBounds.y);
  const combinedMaxX = Math.max(nameBounds.x + nameBounds.width, typeBounds.x + typeBounds.width);
  const combinedMaxY = Math.max(nameText.y + nameBounds.y + nameBounds.height, typeText.y + typeBounds.y + typeBounds.height);
  labelContainer.hitArea = new PIXI.Rectangle(
    Math.floor(combinedMinX - 4),
    Math.floor(combinedMinY - 2),
    Math.max(8, Math.ceil((combinedMaxX - combinedMinX) + 8)),
    Math.max(8, Math.ceil((combinedMaxY - combinedMinY) + 4))
  );
  labelContainer.position.set(Math.round(tokenObject.w / 2), 0);
  labelContainer.visible = tokenObject.visible;
}

function updateResilienceLabel(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const resilience = getResilienceValue(tokenObject.document);
  if (resilience === null || resilience === undefined) {
    const label = tokenObject[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete tokenObject[KEYS.resilienceLabel];
    return;
  }

  let label = tokenObject[KEYS.resilienceLabel];
  const staleLabel = !!label && (
    label.destroyed ||
    label.parent == null ||
    label.parent !== tokenObject
  );
  if (staleLabel) {
    clearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    label = null;
  }

  if (!label) {
    label = new PIXI.Container();
    label.eventMode = "passive";
    label.interactiveChildren = true;

    const hitBox = new PIXI.Graphics();
    hitBox.eventMode = "static";
    hitBox.interactive = true;
    hitBox.buttonMode = true;
    hitBox.cursor = "help";

    const icon = createOverlayIconSprite(ICON_SRC_RES, OVERLAY_FONT_SIZE + 1);
    const valueText = new PreciseTextClass("", getIconValueStyle());
    tuneOverlayText(valueText);
    valueText.anchor.set(0, 0.5);
    valueText.eventMode = "none";

    label.addChild(hitBox);
    label.addChild(icon);
    label.addChild(valueText);
    label._hitBox = hitBox;
    label._icon = icon;
    label._valueText = valueText;
    tokenObject.addChild(label);
    tokenObject[KEYS.resilienceLabel] = label;

    bindTooltipHandlers(hitBox, () => ({
      title: "Resilience",
      description: "Resilience value used for durability and damage resolution thresholds."
    }));
  }

  const hitBox = label._hitBox;
  const icon = label._icon;
  const valueText = label._valueText;
  if (!hitBox || !icon || !valueText) {
    clearDisplayObject(label);
    delete tokenObject[KEYS.resilienceLabel];
    return updateResilienceLabel(tokenObject);
  }

  valueText.text = `${resilience}`;
  tuneOverlayText(valueText);
  const gap = 4;
  const padX = 3;
  const padY = 2;
  icon.position.set(0, Math.round(-icon.height / 2));
  valueText.position.set(Math.round(icon.width + gap), 0);
  const blockWidth = icon.width + gap + valueText.width;
  const blockHeight = Math.max(icon.height, valueText.height);
  drawHitBoxRect(
    hitBox,
    -padX,
    Math.round(-(blockHeight / 2) - padY),
    Math.round(blockWidth + (padX * 2)),
    Math.round(blockHeight + (padY * 2))
  );

  const rowGap = Math.max(18, Math.max(icon.height, valueText.height) + 4);
  const rightTopY = (tokenObject.h / 2) - (rowGap / 2);
  label.position.set(Math.round(tokenObject.w + TOKEN_CONTROL_PAD), Math.round(rightTopY));
  label.visible = tokenObject.visible;
}

function clearAllResilienceLabels() {
  forEachSceneToken((token) => {
    const label = token[KEYS.resilienceLabel];
    if (!label) return;
    label.parent?.removeChild(label);
    label.destroy();
    delete token[KEYS.resilienceLabel];
  });
}

function clearAllNameLabels() {
  forEachSceneToken((token) => {
    const labelContainer = token[KEYS.nameLabel];
    if (!labelContainer) return;
    labelContainer.parent?.removeChild(labelContainer);
    labelContainer.destroy({ children: true });
    delete token[KEYS.nameLabel];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.nameLabelMarker] === true) orphaned.push(child);
  }
  for (const labelContainer of orphaned) clearDisplayObject(labelContainer);
}

