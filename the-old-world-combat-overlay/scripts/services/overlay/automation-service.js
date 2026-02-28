const ensureTowActionsRuntime = typeof globalThis.towCombatOverlayEnsureTowActionsRuntime === "function"
  ? globalThis.towCombatOverlayEnsureTowActionsRuntime
  : async function fallbackEnsureTowActionsRuntime() {
    const api = typeof globalThis.getTowCombatOverlayPublicApi === "function"
      ? globalThis.getTowCombatOverlayPublicApi("towActions")
      : game.towActions;
    return typeof api?.attackActor === "function" &&
      typeof api?.defenceActor === "function" &&
      typeof api?.isShiftHeld === "function" &&
      typeof api?.systemAdapter === "object";
  };

const ensureTowActions = typeof globalThis.towCombatOverlayEnsureTowActions === "function"
  ? globalThis.towCombatOverlayEnsureTowActions
  : async function fallbackEnsureTowActions() {
    const hasApi = typeof game.towActions?.attackActor === "function" &&
      typeof game.towActions?.defenceActor === "function" &&
      typeof game.towActions?.isShiftHeld === "function" &&
      typeof game.towActions?.systemAdapter === "object";
    if (hasApi) return true;

    const loaded = await ensureTowActionsRuntime();
    if (!loaded) {
      ui.notifications.error("The Old World Combat Overlay module API is unavailable.");
      return false;
    }

    return typeof game.towActions?.attackActor === "function" &&
      typeof game.towActions?.defenceActor === "function" &&
      typeof game.towActions?.isShiftHeld === "function" &&
      typeof game.towActions?.systemAdapter === "object";
  };

const addActorCondition = typeof globalThis.towCombatOverlayAddActorCondition === "function"
  ? globalThis.towCombatOverlayAddActorCondition
  : async function fallbackAddActorCondition(actor, condition, options = {}) {
    const adapter = game.towActions?.systemAdapter ?? null;
    if (typeof adapter?.addCondition === "function") return adapter.addCondition(actor, condition, options);
    return actor?.addCondition?.(condition, options) ?? null;
  };

const removeActorCondition = typeof globalThis.towCombatOverlayRemoveActorCondition === "function"
  ? globalThis.towCombatOverlayRemoveActorCondition
  : async function fallbackRemoveActorCondition(actor, condition) {
    const adapter = game.towActions?.systemAdapter ?? null;
    if (typeof adapter?.removeCondition === "function") return adapter.removeCondition(actor, condition);
    return actor?.removeCondition?.(condition) ?? null;
  };

const addActorWound = typeof globalThis.towCombatOverlayAddActorWound === "function"
  ? globalThis.towCombatOverlayAddActorWound
  : async function fallbackAddActorWound(actor, options = {}) {
    const adapter = game.towActions?.systemAdapter ?? null;
    if (typeof adapter?.addWound === "function") return adapter.addWound(actor, options);
    return actor?.system?.addWound?.(options) ?? null;
  };

const applyActorDamage = typeof globalThis.towCombatOverlayApplyActorDamage === "function"
  ? globalThis.towCombatOverlayApplyActorDamage
  : async function fallbackApplyActorDamage(actor, damage, context = {}) {
    const adapter = game.towActions?.systemAdapter ?? null;
    if (typeof adapter?.applyDamage === "function") return adapter.applyDamage(actor, damage, context);
    return actor?.system?.applyDamage?.(damage, context) ?? null;
  };

function armDefaultStaggerChoiceWound(durationMs = AUTO_STAGGER_PATCH_MS) {
  if (typeof globalThis.shouldTowCombatOverlayAutoChooseStaggerWound === "function"
    && !globalThis.shouldTowCombatOverlayAutoChooseStaggerWound()) {
    return () => {};
  }

  const state = game[MODULE_KEY];
  const DialogApi = foundry.applications?.api?.Dialog;
  if (!state || typeof DialogApi?.wait !== "function") return () => {};

  if (!state.staggerWaitPatch) {
    const originalWait = DialogApi.wait.bind(DialogApi);
    state.staggerWaitPatch = { originalWait, refs: 0 };

    DialogApi.wait = async (config, options) => {
      const title = String(config?.window?.title ?? "");
      const content = String(config?.content ?? "");
      const actions = Array.isArray(config?.buttons)
        ? config.buttons.map((b) => String(b?.action ?? ""))
        : Object.values(config?.buttons ?? {}).map((b) => String(b?.action ?? ""));
      const hasStaggerChoices = actions.includes("wound")
        && (actions.includes("prone") || actions.includes("give"));
      const likelyStaggerText = title.toLowerCase().includes("stagger")
        || content.toLowerCase().includes("stagger")
        || content.toLowerCase().includes("choose from the following options");
      if (hasStaggerChoices || likelyStaggerText) return "wound";
      return state.staggerWaitPatch.originalWait(config, options);
    };
  }

  state.staggerWaitPatch.refs += 1;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (!state.staggerWaitPatch) return;
    state.staggerWaitPatch.refs = Math.max(0, state.staggerWaitPatch.refs - 1);
    if (state.staggerWaitPatch.refs === 0) {
      DialogApi.wait = state.staggerWaitPatch.originalWait;
      delete state.staggerWaitPatch;
    }
  };

  const timer = setTimeout(restore, durationMs);
  return () => {
    clearTimeout(timer);
    restore();
  };
}

function armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
  if (typeof globalThis.shouldTowCombatOverlayAutoDefence === "function"
    && !globalThis.shouldTowCombatOverlayAutoDefence()) {
    return;
  }

  if (!sourceToken?.actor || !targetToken?.actor?.isOwner) return;

  let timeoutId = null;
  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    if (message?.type !== "opposed") return;
    if (message.system?.defender?.token !== targetToken.id) return;

    const attackerMessage = game.messages.get(message.system?.attackerMessage);
    const attackerActorUuid = attackerMessage?.system?.test?.actor;
    if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

    const state = game[MODULE_KEY];
    if (state) {
      if (!state.autoDefenceHandled) state.autoDefenceHandled = new Set();
      if (state.autoDefenceHandled.has(message.id)) return;
      state.autoDefenceHandled.add(message.id);
    }

    cleanup(hookId);
    if (!(await ensureTowActions())) return;

    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      if (targetToken.actor.system?.opposed?.id === message.id) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await game.towActions.defenceActor(targetToken.actor, { manual: false });
    armAutoApplyDamageForOpposed(message, {
      sourceActor: sourceToken.actor,
      sourceBeforeState
    });
  });

  timeoutId = setTimeout(() => cleanup(hookId), AUTO_DEFENCE_WAIT_MS);
}

function armAutoApplyDamageForOpposed(opposedMessage, { sourceActor = null, sourceBeforeState = null } = {}) {
  if (typeof globalThis.shouldTowCombatOverlayAutoApplyDamage === "function"
    && !globalThis.shouldTowCombatOverlayAutoApplyDamage()) {
    return;
  }

  if (!opposedMessage?.id) return;
  const state = game[MODULE_KEY];
  if (state) {
    if (!state.autoApplyArmed) state.autoApplyArmed = new Set();
    if (state.autoApplyArmed.has(opposedMessage.id)) return;
    state.autoApplyArmed.add(opposedMessage.id);
  }

  const cleanup = () => {
    state?.autoApplyArmed?.delete(opposedMessage.id);
    state?.autoDefenceHandled?.delete(opposedMessage.id);
  };
  void (async () => {
    let applying = false;
    let separatorPosted = false;
    const postSeparatorOnce = async (opposed) => {
      if (separatorPosted) return;
      separatorPosted = true;
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints: [] });
    };

    const started = Date.now();
    while (Date.now() - started < AUTO_APPLY_WAIT_MS) {
      const message = game.messages.get(opposedMessage.id);
      const opposed = message?.system;
      if (!opposed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const computed = opposed.result?.computed === true;
      const hasDamage = typeof opposed.result?.damage !== "undefined" && opposed.result?.damage !== null;
      const alreadyApplied = opposed.result?.damage?.applied === true;
      if (!computed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (!hasDamage || alreadyApplied) {
        await postSeparatorOnce(opposed);
        break;
      }

      const defenderActor = ChatMessage.getSpeakerActor(opposed.defender);
      if (!defenderActor?.isOwner || applying) {
        await postSeparatorOnce(opposed);
        break;
      }

      applying = true;
      const beforeState = snapshotActorState(defenderActor);
      const damageValue = Number(opposed.result?.damage?.value ?? 0);
      await applyDamageWithWoundsFallback(defenderActor, damageValue, {
        opposed,
        item: opposed.attackerTest?.item,
        test: opposed.attackerMessage?.system?.test
      });
      const afterState = await captureSettledActorState(defenderActor, beforeState, 700);
      const targetStatusHints = deriveAppliedStatusLabels(beforeState, afterState);
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      if (!separatorPosted) {
        separatorPosted = true;
        await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints });
      }
      break;
    }
    cleanup();
  })();
}

async function applyDamageWithWoundsFallback(defenderActor, damageValue, context) {
  const system = defenderActor?.system;
  if (!system || typeof system.applyDamage !== "function") return;

  const originalAddWound = (typeof system.addWound === "function") ? system.addWound.bind(system) : null;
  if (!originalAddWound) {
    await applyActorDamage(defenderActor, damageValue, context);
    return;
  }

  system.addWound = async function wrappedAddWound(options = {}) {
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    if (!hasTable) return originalAddWound({ ...options, roll: false });
    try {
      return await originalAddWound(options);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) {
        return originalAddWound({ ...options, roll: false });
      }
      throw error;
    }
  };

  try {
    await applyActorDamage(defenderActor, damageValue, context);
  } finally {
    system.addWound = originalAddWound;
  }
}

function snapshotActorState(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  const wounds = Number(actor?.itemTypes?.wound?.length ?? 0);
  return { statuses, wounds };
}

async function captureSettledActorState(actor, baselineState, settleMs = 700) {
  const started = Date.now();
  let last = snapshotActorState(actor);
  let stableFor = 0;

  while (Date.now() - started < settleMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const current = snapshotActorState(actor);
    const sameWounds = current.wounds === last.wounds;
    const sameStatuses = current.statuses.size === last.statuses.size
      && Array.from(current.statuses).every((s) => last.statuses.has(s));
    if (sameWounds && sameStatuses) {
      stableFor += 80;
      if (stableFor >= 160) return current;
    } else {
      stableFor = 0;
      last = current;
    }
  }

  const finalState = snapshotActorState(actor);
  if ((finalState.wounds ?? 0) < (baselineState?.wounds ?? 0)) return last;
  return finalState;
}

async function deriveSourceStatusHints(sourceActor, sourceBeforeState) {
  if (!sourceActor || !sourceBeforeState) return [];
  const sourceAfterState = await captureSettledActorState(sourceActor, sourceBeforeState, 500);
  return deriveAppliedStatusLabels(sourceBeforeState, sourceAfterState);
}

function deriveAppliedStatusLabels(before, after) {
  const labels = [];
  const add = (label) => {
    if (!label) return;
    if (!labels.includes(label)) labels.push(label);
  };

  if ((after?.wounds ?? 0) > (before?.wounds ?? 0)) add("Wound");

  const beforeStatuses = before?.statuses ?? new Set();
  const afterStatuses = after?.statuses ?? new Set();
  for (const statusId of afterStatuses) {
    if (beforeStatuses.has(statusId)) continue;
    const label = game.oldworld?.config?.conditions?.[statusId]?.name
      ?? game.i18n.localize(`TOW.ConditionName.${statusId}`)
      ?? statusId;
    add(label);
  }
  return labels;
}

function getFlowNamesMarkup(attackerName, defenderName) {
  const attackerSafe = foundry.utils.escapeHTML(attackerName);
  const defenderSafe = foundry.utils.escapeHTML(defenderName);
  const combinedLen = `${attackerName} vs. ${defenderName}`.length;
  const needsStacked = combinedLen > 34 || attackerName.length > 18 || defenderName.length > 18;

  if (!needsStacked) {
    return `<div style="font-size: inherit; text-align:center; font-weight:700;">
      ${attackerSafe} vs. ${defenderSafe}
    </div>`;
  }

  return `<div style="font-size: inherit; text-align:center; font-weight:700; display:flex; flex-direction:column; align-items:center; line-height:1.2; gap:1px;">
    <div>${attackerSafe}</div>
    <div style="font-weight:600; opacity:0.85;">vs.</div>
    <div>${defenderSafe}</div>
  </div>`;
}

async function postFlowSeparatorCard(opposed, { sourceStatusHints = [], targetStatusHints = [] } = {}) {
  const attackerName = opposed?.attackerToken?.name ?? "Attacker";
  const defenderName = opposed?.defenderToken?.name ?? opposed?.defender?.alias ?? "Defender";
  const outcome = opposed?.result?.outcome ?? "resolved";
  const outcomeText = String(outcome);
  const outcomeLabel = outcomeText.charAt(0).toUpperCase() + outcomeText.slice(1).toLowerCase();
  const margin = Number(opposed?.result?.successes ?? 0);
  const marginLabel = `${margin >= 0 ? "+" : ""}${margin}`;
  const damageValue = Number(opposed?.result?.damage?.value ?? 0);
  const damageLabel = Number.isFinite(damageValue) && damageValue > 0 ? String(damageValue) : "0";

  const statusLabels = [];
  const pushStatus = (label) => {
    if (!label) return;
    if (!statusLabels.includes(label)) statusLabels.push(label);
  };

  const damageMessageKey = String(opposed?.result?.damage?.message ?? "");
  if (damageMessageKey.includes("TakesWound")) pushStatus("Wound");
  if (damageMessageKey.includes("GainsStaggered")) pushStatus("Staggered");
  if (damageMessageKey.includes("SuffersFault")) pushStatus("Fault");

  const effectStatuses = Array.isArray(opposed?.attackerTest?.damageEffects)
    ? opposed.attackerTest.damageEffects.flatMap((effect) => Array.from(effect?.statuses ?? []))
    : [];
  for (const status of effectStatuses) {
    const key = String(status ?? "");
    const label = game.oldworld?.config?.conditions?.[key]?.name
      ?? game.i18n.localize(`TOW.ConditionName.${key}`)
      ?? key;
    pushStatus(label);
  }

  for (const label of targetStatusHints) pushStatus(label);
  const targetStatusLabels = [...statusLabels];
  const sourceStatusLabels = Array.from(new Set((sourceStatusHints ?? []).filter(Boolean)));

  const outcomeColor = outcome === "success" ? "#2e7d32" : outcome === "failure" ? "#9b1c1c" : "#6b5e3a";
  const marginColor = margin > 0 ? "#2e7d32" : margin < 0 ? "#9b1c1c" : "#6b5e3a";
  const damageColor = damageValue > 0 ? "#9b1c1c" : "#6b5e3a";

  const statusColorFor = (label) => {
    const key = String(label).toLowerCase();
    if (key.includes("wound")) return { bg: "#5e1f1f", fg: "#ffd9d9", border: "#b75b5b" };
    if (key.includes("stagger")) return { bg: "#5a4a18", fg: "#ffe8a6", border: "#c9a447" };
    if (key.includes("prone")) return { bg: "#24344f", fg: "#d6e6ff", border: "#5f84c6" };
    if (key.includes("fault")) return { bg: "#4b214f", fg: "#f0d8ff", border: "#a164bf" };
    return { bg: "#3a362b", fg: "#efe8d2", border: "#8f8468" };
  };

  const statusMarkupFrom = (labels) => labels.length
    ? labels.map((label) => {
      const c = statusColorFor(label);
      return `<span style="
        display:inline-block;
        margin:0 2px;
        padding:1px 6px;
        border-radius:10px;
        border:1px solid ${c.border};
        background:${c.bg};
        color:${c.fg};
        font-size:${FLOW_CARD_CHIP_FONT_SIZE};
        line-height:1.4;
      ">${foundry.utils.escapeHTML(label)}</span>`;
    }).join("")
    : `<span style="
      display:inline-block;
      margin:0 2px;
      padding:1px 6px;
      border-radius:10px;
      border:1px solid #8f8468;
      background:#3a362b;
      color:#efe8d2;
      font-size:${FLOW_CARD_CHIP_FONT_SIZE};
      line-height:1.4;
    ">None</span>`;

  const sourceStatusMarkup = statusMarkupFrom(sourceStatusLabels);
  const targetStatusMarkup = statusMarkupFrom(targetStatusLabels);
  const namesMarkup = getFlowNamesMarkup(attackerName, defenderName);

  const content = `<div style="
      border-top: 1px solid rgba(130,110,80,0.45);
      border-bottom: 1px solid rgba(130,110,80,0.45);
      margin: 4px 0;
      padding: 7px 8px;
      text-align: center;
      letter-spacing: 0.04em;
      opacity: 0.9;
      line-height: 1.35;
      font-size: ${FLOW_CARD_FONT_SIZE};">
      ${namesMarkup}
      <div style="margin-top:2px; font-size: inherit; text-align:center;">
        <strong style="color:${outcomeColor};">${foundry.utils.escapeHTML(outcomeLabel)}</strong>
      </div>
      <div style="margin-top:2px; font-size: inherit; text-align:center;">
        Margin: <strong style="color:${marginColor};">${foundry.utils.escapeHTML(marginLabel)}</strong>
        &nbsp;|&nbsp;
        Damage: <strong style="color:${damageColor};">${foundry.utils.escapeHTML(damageLabel)}</strong>
      </div>
      <div style="margin-top:5px; display:flex; flex-direction:column; gap:4px; align-items:stretch; text-align:left;">
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span style="opacity:0.8; min-width:56px;">Source:</span>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">${sourceStatusMarkup}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span style="opacity:0.8; min-width:56px;">Target:</span>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">${targetStatusMarkup}</div>
        </div>
      </div>
    </div>`;

  await ChatMessage.create({
    content,
    speaker: { alias: "Combat Flow" }
  });
}
