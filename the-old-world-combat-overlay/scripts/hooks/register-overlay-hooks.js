function registerTowCombatOverlayHooks() {
  return {
    canvasReady: Hooks.on("canvasReady", refreshAllOverlays),
    canvasPan: Hooks.on("canvasPan", (_canvas, viewPosition) => {
      const state = game[MODULE_KEY];
      if (!state) return;
      const nextScale = Number(viewPosition?.scale ?? canvas?.stage?.scale?.x ?? 1);
      const lastScale = Number(state.lastCanvasScale ?? NaN);
      if (Number.isFinite(lastScale) && Math.abs(nextScale - lastScale) < 0.01) return;
      state.lastCanvasScale = nextScale;
      refreshAllOverlays();
    }),
    refreshToken: Hooks.on("refreshToken", (token) => refreshTokenOverlay(token)),
    hoverToken: Hooks.on("hoverToken", (token, hovered) => {
      hideCoreTokenHoverVisuals(token);
      updateCustomLayoutBorderVisibility(token, { hovered });
    }),
    controlToken: Hooks.on("controlToken", (token, controlled) => {
      if (controlled) void bringTokenToFront(token);
      hideCoreTokenHoverVisuals(token);
      updateCustomLayoutBorderVisibility(token, { controlled });
    }),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      refreshActorOverlays(item.parent);
      queueActorOverlayResync(item.parent);
      queueDeadSyncFromWounds(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => refreshActorOverlays(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => refreshActorOverlays(effect?.parent))
  };
}

function unregisterTowCombatOverlayHooks(hookIds) {
  Hooks.off("canvasReady", hookIds.canvasReady);
  Hooks.off("canvasPan", hookIds.canvasPan);
  Hooks.off("refreshToken", hookIds.refreshToken);
  Hooks.off("hoverToken", hookIds.hoverToken);
  Hooks.off("controlToken", hookIds.controlToken);
  Hooks.off("createItem", hookIds.createItem);
  Hooks.off("updateItem", hookIds.updateItem);
  Hooks.off("deleteItem", hookIds.deleteItem);
  Hooks.off("createActiveEffect", hookIds.createActiveEffect);
  Hooks.off("updateActiveEffect", hookIds.updateActiveEffect);
  Hooks.off("deleteActiveEffect", hookIds.deleteActiveEffect);
}

globalThis.registerTowCombatOverlayHooks = registerTowCombatOverlayHooks;
globalThis.unregisterTowCombatOverlayHooks = unregisterTowCombatOverlayHooks;
