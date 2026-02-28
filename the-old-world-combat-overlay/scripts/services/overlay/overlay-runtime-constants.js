const MODULE_KEY = "towMacroToggleOverlay";
const PreciseTextClass = foundry.canvas.containers.PreciseText;

const KEYS = {
  woundUI: "_towWoundControlUI",
  woundUiMarker: "_towOverlayWoundUiMarker",
  woundUiTokenId: "_towOverlayWoundUiTokenId",
  nameLabel: "_towNameLabel",
  nameLabelMarker: "_towOverlayNameLabelMarker",
  nameLabelTokenId: "_towOverlayNameLabelTokenId",
  resilienceLabel: "_towResilienceLabel",
  defaultEffectsVisible: "_towDefaultEffectsVisible",
  statusPaletteLayer: "_towStatusPaletteLayer",
  statusPaletteBackdrop: "_towStatusPaletteBackdrop",
  statusPaletteMarker: "_towOverlayStatusPaletteMarker",
  statusPaletteTokenId: "_towOverlayStatusPaletteTokenId",
  statusPaletteMetrics: "_towStatusPaletteMetrics",
  deadVisualState: "_towDeadVisualState",
  statusIconHandler: "_towStatusIconHandler",
  statusIconTooltipOverHandler: "_towStatusIconTooltipOverHandler",
  statusIconTooltipMoveHandler: "_towStatusIconTooltipMoveHandler",
  statusIconTooltipOutHandler: "_towStatusIconTooltipOutHandler",
  tokenInteractiveChildrenOriginal: "_towTokenInteractiveChildrenOriginal",
  tokenHitAreaOriginal: "_towTokenHitAreaOriginal",
  coreTooltipVisible: "_towCoreTooltipVisible",
  coreTooltipRenderable: "_towCoreTooltipRenderable",
  coreNameplateVisible: "_towCoreNameplateVisible",
  coreNameplateRenderable: "_towCoreNameplateRenderable",
  coreBorderVisible: "_towCoreBorderVisible",
  coreBorderAlpha: "_towCoreBorderAlpha",
  layoutBorder: "_towLayoutBorder",
  layoutBounds: "_towLayoutBounds"
};

const STATUS_PALETTE_ICON_SIZE = 20;
const STATUS_PALETTE_ICON_GAP = 2;
const STATUS_PALETTE_ROWS = 2;
const TOKEN_CONTROL_PAD = 6;
const NAME_TYPE_STACK_OVERLAP_PX = 13;
const NAME_TYPE_TO_TOKEN_OFFSET_PX = 6;
const STATUS_PALETTE_TOKEN_PAD = TOKEN_CONTROL_PAD;
const STATUS_PALETTE_INACTIVE_TINT = 0x565656;
const STATUS_PALETTE_INACTIVE_ALPHA = 0.36;
const STATUS_PALETTE_ACTIVE_TINT = 0xFFFFFF;
const STATUS_PALETTE_STAGGERED_RING = 0xFFD54A;
const STATUS_PALETTE_DEAD_RING = 0xFFFFFF;
const STATUS_PALETTE_SPECIAL_BG_PAD = 1;
const STATUS_PALETTE_SPECIAL_BG_RADIUS = 3;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE = 0x171717;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH = 1;
const STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA = 0.72;
const STATUS_PALETTE_SPECIAL_BG_STAGGERED_ALPHA = 0.58;
const STATUS_PALETTE_SPECIAL_BG_DEAD_ALPHA = 0.62;
const STATUS_PALETTE_BACKDROP_COLOR = 0xFFF4D8;
const STATUS_PALETTE_BACKDROP_FILL_ALPHA = 0.22;
const STATUS_PALETTE_BACKDROP_BORDER_COLOR = 0xE0C27B;
const STATUS_PALETTE_BACKDROP_BORDER_ALPHA = 0.46;
const STATUS_PALETTE_BACKDROP_BORDER_WIDTH = 1;
const STATUS_PALETTE_BACKDROP_RADIUS = 6;
const STATUS_PALETTE_BACKDROP_PAD_X = 4;
const STATUS_PALETTE_BACKDROP_PAD_Y = 3;
const LAYOUT_BORDER_COLOR = 0xE39A1A;
const LAYOUT_BORDER_ALPHA = 1;
const LAYOUT_BORDER_WIDTH = 2;
const LAYOUT_BORDER_RADIUS = 6;
const OVERLAY_FONT_SIZE = 22;
const DRAG_START_THRESHOLD_PX = 8;
const DRAG_LINE_OUTER_COLOR = 0x1A0909;
const DRAG_LINE_OUTER_ALPHA = 0.85;
const DRAG_LINE_OUTER_WIDTH = 7;
const DRAG_LINE_INNER_COLOR = 0x8F2A2A;
const DRAG_LINE_INNER_ALPHA = 0.96;
const DRAG_LINE_INNER_WIDTH = 3;
const DRAG_ARROW_SIZE = 13;
const DRAG_ENDPOINT_OUTER_RADIUS = 6;
const DRAG_ENDPOINT_RING_WIDTH = 2;
const DRAG_STYLE_SCALE_EXP = 1.05;
const ATTACK_DEDUPE_WINDOW_MS = 700;
const TARGET_DEDUPE_WINDOW_MS = 300;
const AUTO_DEFENCE_WAIT_MS = 4000;
const AUTO_APPLY_WAIT_MS = 10000;
const OPPOSED_LINK_WAIT_MS = 700;
const AUTO_STAGGER_PATCH_MS = 12000;
const FLOW_CARD_FONT_SIZE = "var(--font-size-16)";
const FLOW_CARD_CHIP_FONT_SIZE = "var(--font-size-12)";
const ACTOR_OVERLAY_RESYNC_DELAYS_MS = [50, 180];
const DEAD_SYNC_DEBOUNCE_MS = 60;
const DEAD_TO_WOUND_SYNC_DEBOUNCE_MS = 80;
const STATUS_TOOLTIP_FONT_SIZE = 14;
const STATUS_TOOLTIP_MAX_WIDTH = 260;
const STATUS_TOOLTIP_PAD_X = 8;
const STATUS_TOOLTIP_PAD_Y = 6;
const STATUS_TOOLTIP_OFFSET_X = 12;
const STATUS_TOOLTIP_OFFSET_Y = 12;
const STATUS_TOOLTIP_BG_COLOR = 0x0F0C09;
const STATUS_TOOLTIP_BG_ALPHA = 0.94;
const STATUS_TOOLTIP_BORDER_COLOR = 0xC18B2C;
const STATUS_TOOLTIP_BORDER_ALPHA = 0.9;
const STATUS_TOOLTIP_DOM_CLASS = "tow-overlay-status-tooltip";
const OVERLAY_TEXT_RESOLUTION_MIN = 3;
const OVERLAY_TEXT_RESOLUTION_MAX = 8;
const OVERLAY_CONTROL_ICON_TINT = 0xFFF4D8;
const OVERLAY_CONTROL_ICON_OUTLINE_COLOR = 0x2A2620;
const OVERLAY_CONTROL_ICON_OUTLINE_THICKNESS = 1.4;
const OVERLAY_CONTROL_ICON_OUTLINE_ALPHA = 0.58;
const OVERLAY_TOKEN_BASE_PX = 100;
const OVERLAY_SCALE_MIN = 0.26;
const OVERLAY_SCALE_MAX = 1.75;
const OVERLAY_SCALE_EXP_SMALL = 0.85;
const OVERLAY_SCALE_EXP_LARGE = 0.75;
const OVERLAY_EDGE_PAD_MIN_FACTOR = 0.58;
const OVERLAY_EDGE_PAD_EXP = 0.65;
const LAYOUT_BORDER_SCALE_EXP = 1.15;
const LAYOUT_BORDER_RADIUS_SCALE_EXP = 0.96;
const STATUS_SPECIAL_BG_ICON_SCALE_MIN = 0.45;
const STATUS_SPECIAL_BG_ICON_SCALE_MAX = 1.2;
const STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP = 1.2;
const STATUS_SPECIAL_BG_RADIUS_SCALE_EXP = 0.95;

const WOUND_ITEM_TYPE = "wound";
const ICON_SRC_ATK = "icons/svg/sword.svg";
const ICON_SRC_DEF = "icons/svg/shield.svg";
const ICON_SRC_WOUND = "icons/svg/blood.svg";
const ICON_SRC_RES = "icons/svg/statue.svg";

function getLayoutBorderStyle(tokenObject) {
  const overlayScale = getTokenOverlayScale(tokenObject);
  const width = clampNumber(LAYOUT_BORDER_WIDTH * Math.pow(overlayScale, LAYOUT_BORDER_SCALE_EXP), 0.68, 2.1);
  const radius = clampNumber(LAYOUT_BORDER_RADIUS * Math.pow(overlayScale, LAYOUT_BORDER_RADIUS_SCALE_EXP), 2.8, 8.5);
  const alpha = clampNumber(LAYOUT_BORDER_ALPHA * (0.78 + (overlayScale * 0.22)), 0.68, 1);
  return {
    width: roundTo(width),
    radius: roundTo(radius),
    alpha: roundTo(alpha)
  };
}

function getStatusSpecialBgStyle(iconSize, baseFillAlpha) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = clampNumber(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, STATUS_SPECIAL_BG_ICON_SCALE_MAX);
  const pad = clampNumber(STATUS_PALETTE_SPECIAL_BG_PAD * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP), 0.45, 2.4);
  const outlineWidth = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_WIDTH * Math.pow(iconScale, STATUS_SPECIAL_BG_OUTLINE_SCALE_EXP),
    0.28,
    2.2
  );
  const radius = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_RADIUS * Math.pow(iconScale, STATUS_SPECIAL_BG_RADIUS_SCALE_EXP),
    1.25,
    6
  );
  const outlineAlpha = clampNumber(
    STATUS_PALETTE_SPECIAL_BG_OUTLINE_ALPHA * (0.72 + (iconScale * 0.28)),
    0.26,
    0.9
  );
  const fillAlpha = clampNumber(Number(baseFillAlpha) * (0.76 + (iconScale * 0.24)), 0.16, 0.9);
  return {
    pad: roundTo(pad),
    outlineWidth: roundTo(outlineWidth),
    radius: roundTo(radius),
    outlineAlpha: roundTo(outlineAlpha),
    fillAlpha: roundTo(fillAlpha)
  };
}

function getStatusPaletteBackdropStyle(iconSize) {
  const size = Number(iconSize);
  const sizeSafe = Number.isFinite(size) && size > 0 ? size : STATUS_PALETTE_ICON_SIZE;
  const iconScale = clampNumber(sizeSafe / STATUS_PALETTE_ICON_SIZE, STATUS_SPECIAL_BG_ICON_SCALE_MIN, 1.3);
  return {
    padX: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_PAD_X * Math.pow(iconScale, 0.95), 2.2, 9)),
    padY: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_PAD_Y * Math.pow(iconScale, 0.95), 1.8, 7)),
    borderWidth: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_BORDER_WIDTH * Math.pow(iconScale, 1.05), 0.45, 1.8)),
    radius: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_RADIUS * Math.pow(iconScale, 0.98), 2.8, 10)),
    fillAlpha: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_FILL_ALPHA * (0.84 + (iconScale * 0.16)), 0.14, 0.34)),
    borderAlpha: roundTo(clampNumber(STATUS_PALETTE_BACKDROP_BORDER_ALPHA * (0.9 + (iconScale * 0.1)), 0.32, 0.62))
  };
}
