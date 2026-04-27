import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  buildFountain,
  buildFdx,
  buildPdfBlob,
  buildPlainText,
  buildRtf,
  defaultFormat,
  detectType,
  getNextType,
  getPreviousType,
  predictNextType,
  revisionBackground,
  sceneHeadingSuggestions,
  shotSuggestions,
  transitionSuggestions,
} from "../lib/screenplayFormat";
import type {
  ExportSettings,
  FormatSettings,
  TitlePageData,
} from "../lib/screenplayFormat";
import AppLayout from "./AppLayout";
import FormatTipsBox from "./FormatTipsBox";
import ScriptToolbar from "./ScriptToolbar";
import { useScriptStore } from "../store/useScriptStore";
import type { RevisionColor, ScriptBlock } from "../types/script";

const VISUAL_PAGE_MAX_WIDTH_PX = 816;
const VISUAL_PAGE_MIN_HEIGHT_PX = 1056;
const VISUAL_PAGE_PADDING_TOP_PX = 96;
const VISUAL_PAGE_PADDING_BOTTOM_PX = 96;
const VISUAL_PAGE_PADDING_LEFT_PX = 144;
const VISUAL_PAGE_PADDING_RIGHT_PX = 96;
const VISUAL_PAGE_CONTENT_WIDTH_PX =
  VISUAL_PAGE_MAX_WIDTH_PX -
  VISUAL_PAGE_PADDING_LEFT_PX -
  VISUAL_PAGE_PADDING_RIGHT_PX;
const VISUAL_PAGE_VERTICAL_PADDING_PX =
  VISUAL_PAGE_PADDING_TOP_PX + VISUAL_PAGE_PADDING_BOTTOM_PX;

type BlockSuggestionKind =
  | "scene_heading"
  | "scene_heading_suffix"
  | "transition"
  | "shot"
  | "character";

type BlockSuggestionState = {
  kind: BlockSuggestionKind;
  options: string[];
};

const TRANSITION_PREFIX_HINTS = ["CUT", "FADE", "DISS", "MATCH", "SMASH"];
const SHOT_PREFIX_HINTS = ["CLOSE", "ANGLE", "POV", "INSERT", "WIDE", "TRACKING"];
const SCENE_TIME_SUFFIXES = [
  " - DAY",
  " - NIGHT",
  " - MORNING",
  " - EVENING",
  " - CONTINUOUS",
  " - LATER",
] as const;
const FORMAT_TIPS_STORAGE_KEY = "pageone:show-format-tips";
const TYPEWRITER_MODE_STORAGE_KEY = "pageone:typewriter-mode";
const TYPEWRITER_TARGET_RATIO = 0.42;
const INCH_PX = 96;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string, type = "text/plain") {
  downloadBlob(filename, new Blob([content], { type: `${type};charset=utf-8` }));
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return 0;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
  return textarea.scrollHeight;
}

function createEmptySceneHeadingBlock(): ScriptBlock {
  return {
    id: crypto.randomUUID(),
    type: "scene_heading",
    text: "",
    revisionColor: "none",
    locked: false,
    note: "",
  };
}

function elementBackground(
  type: ScriptBlock["type"],
  isActive: boolean
): string {
  void type;
  void isActive;
  return "transparent";
}

function elementAccent(type: ScriptBlock["type"]) {
  if (type === "scene_heading" || type === "scene") return "#d6d1c8";
  if (type === "dialogue") return "#ddd8cf";
  if (type === "parenthetical") return "#d9d4cb";
  if (type === "transition") return "#d3cec4";
  if (type === "shot") return "#d8d3ca";
  if (type === "character") return "#d8d3ca";
  return "transparent";
}

function isSceneHeadingType(type: ScriptBlock["type"]) {
  return type === "scene_heading" || type === "scene";
}

function blockTypeLabel(type: ScriptBlock["type"]) {
  if (isSceneHeadingType(type)) return "scene heading";
  if (type === "parenthetical") return "parenthetical";
  if (type === "transition") return "transition";
  if (type === "shot") return "shot";
  return type;
}

function getBlockVerticalSpacing(type: ScriptBlock["type"]) {
  const marginTopIn = isSceneHeadingType(type)
    ? 0.28
    : type === "transition"
      ? 0.24
      : type === "shot"
        ? 0.16
        : type === "character"
          ? 0.2
          : type === "parenthetical"
            ? 0.02
            : type === "dialogue"
              ? 0.01
              : type === "action" || type === "general"
                ? 0.03
                : 0;

  const marginBottomIn = isSceneHeadingType(type)
    ? 0.1
    : type === "transition"
      ? 0.1
      : type === "shot"
        ? 0.08
        : type === "character"
          ? 0.02
          : type === "parenthetical"
            ? 0.03
            : type === "dialogue"
              ? 0.11
              : type === "action" || type === "general"
                ? 0.05
                : 0;

  return {
    marginTopIn,
    marginBottomIn,
    marginTopPx: marginTopIn * INCH_PX,
    marginBottomPx: marginBottomIn * INCH_PX,
  };
}

function normalizeCharacterCue(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function hasStrongSuggestionPrefixMatch(
  kind: BlockSuggestionKind,
  typedText: string,
  suggestion: string
) {
  if (kind === "scene_heading_suffix") {
    const suffixFragmentMatch = typedText.match(/\s-\s?([A-Za-z]*)$/);
    const suffixFragment = suffixFragmentMatch?.[1]?.toUpperCase() ?? "";
    if (suffixFragment.length < 1) return false;

    const suggestionSuffix = suggestion.replace(/^\s*-\s*/, "").toUpperCase();
    return (
      suggestionSuffix.startsWith(suffixFragment) &&
      suggestionSuffix !== suffixFragment
    );
  }

  const normalizedTyped = normalizeCharacterCue(typedText);
  const normalizedSuggestion = normalizeCharacterCue(suggestion);
  return (
    normalizedTyped.length >= 1 &&
    normalizedSuggestion.startsWith(normalizedTyped) &&
    normalizedSuggestion !== normalizedTyped
  );
}

function isExactKnownSuggestion(
  kind: BlockSuggestionKind,
  typedText: string,
  allBlocks: ScriptBlock[]
) {
  const normalizedTyped = normalizeCharacterCue(typedText);
  if (!normalizedTyped) return false;

  if (kind === "character") {
    return allBlocks.some(
      (candidate) =>
        candidate.type === "character" &&
        normalizeCharacterCue(candidate.text) === normalizedTyped
    );
  }

  if (kind === "scene_heading") {
    return sceneHeadingSuggestions.some(
      (suggestion) => normalizeCharacterCue(suggestion) === normalizedTyped
    );
  }

  if (kind === "transition") {
    return transitionSuggestions.some(
      (suggestion) => normalizeCharacterCue(suggestion) === normalizedTyped
    );
  }

  if (kind === "shot") {
    return shotSuggestions.some(
      (suggestion) => normalizeCharacterCue(suggestion) === normalizedTyped
    );
  }

  return SCENE_TIME_SUFFIXES.some((suffix) =>
    normalizeCharacterCue(typedText).endsWith(normalizeCharacterCue(suffix))
  );
}

function getBlockSuggestions(
  block: ScriptBlock,
  allBlocks: ScriptBlock[]
): BlockSuggestionState | null {
  const normalizedType = block.type === "scene" ? "scene_heading" : block.type;
  const query = block.text.trim().toUpperCase();

  if (normalizedType === "character") {
    const normalizedQuery = normalizeCharacterCue(block.text);

    const charactersByNormalized = new Map<string, string>();
    allBlocks.forEach((candidate) => {
      if (candidate.type !== "character") return;
      const displayText = candidate.text.trim();
      if (!displayText) return;
      const normalizedText = normalizeCharacterCue(displayText);
      if (!normalizedText || charactersByNormalized.has(normalizedText)) return;
      charactersByNormalized.set(normalizedText, displayText);
    });

    const characterNames = Array.from(charactersByNormalized.entries()).map(
      ([normalized, display]) => ({ normalized, display })
    );
    if (characterNames.length === 0) return null;

    // TODO: Add SmartType-style next-speaker prediction from dialogue flow.
    if (normalizedQuery.length === 0) {
      const options = characterNames
        .sort((left, right) => left.normalized.localeCompare(right.normalized))
        .map((option) => option.display)
        .slice(0, 10);
      return options.length ? { kind: "character", options } : null;
    }

    const nonExactNames = characterNames.filter(
      (option) => option.normalized !== normalizedQuery
    );
    const prefixMatches = nonExactNames
      .filter((option) => option.normalized.startsWith(normalizedQuery))
      .sort((left, right) => left.normalized.localeCompare(right.normalized));
    if (prefixMatches.length === 0) return null;

    const remaining = nonExactNames
      .filter((option) => !option.normalized.startsWith(normalizedQuery))
      .sort((left, right) => left.normalized.localeCompare(right.normalized));
    const options = [...prefixMatches, ...remaining]
      .map((option) => option.display)
      .slice(0, 10);
    return options.length ? { kind: "character", options } : null;
  }

  if (normalizedType === "scene_heading") {
    if (!query) return null;

    if (!query.includes(" ")) {
      const options = sceneHeadingSuggestions
        .filter((suggestion) => suggestion.startsWith(query))
        .filter((suggestion) => suggestion !== query);
      return options.length ? { kind: "scene_heading", options: [...options] } : null;
    }

    const headingMatch = query.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.)(.*)$/);
    if (!headingMatch) return null;

    const remainder = (headingMatch[2] ?? "").trimStart();
    if (!remainder) return null;

    const alreadyHasTimeSuffix = SCENE_TIME_SUFFIXES.some((suffix) =>
      query.endsWith(suffix)
    );
    if (alreadyHasTimeSuffix) return null;

    const dashIndex = remainder.lastIndexOf(" - ");
    if (dashIndex >= 0) {
      const locationPart = remainder.slice(0, dashIndex).trim();
      const suffixFragment = remainder.slice(dashIndex).toUpperCase();
      if (!locationPart) return null;

      const options = SCENE_TIME_SUFFIXES.filter((suffix) =>
        suffix.startsWith(suffixFragment)
      );
      return options.length
        ? { kind: "scene_heading_suffix", options: [...options] }
        : null;
    }

    return {
      kind: "scene_heading_suffix",
      options: [...SCENE_TIME_SUFFIXES],
    };
  }

  const transitionTriggered =
    normalizedType === "transition" ||
    TRANSITION_PREFIX_HINTS.some((prefix) => query.startsWith(prefix));
  if (transitionTriggered) {
    const options = transitionSuggestions
      .filter((suggestion) => !query || suggestion.startsWith(query))
      .filter((suggestion) => suggestion !== query);
    return options.length ? { kind: "transition", options: [...options] } : null;
  }

  const shotTriggered =
    normalizedType === "shot" ||
    SHOT_PREFIX_HINTS.some((prefix) => query.startsWith(prefix));
  if (shotTriggered) {
    const options = shotSuggestions
      .filter((suggestion) => !query || suggestion.startsWith(query))
      .filter((suggestion) => suggestion !== query);
    return options.length ? { kind: "shot", options: [...options] } : null;
  }

  return null;
}

function replaceLeadingQuery(text: string, suggestion: string) {
  const trimmedStart = text.replace(/^\s+/, "");
  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? "";
  const parts = trimmedStart.split(/\s+/);
  const firstToken = parts[0] ?? "";
  let remainder = trimmedStart.slice(firstToken.length).trimStart();

  const suggestionWords = suggestion
    .toUpperCase()
    .replace(/[.:]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  while (remainder.length > 0) {
    const remainderParts = remainder.split(/\s+/);
    const remainderFirst = (remainderParts[0] ?? "")
      .toUpperCase()
      .replace(/[.:]/g, "");
    if (!remainderFirst || !suggestionWords.includes(remainderFirst)) break;
    remainder = remainder.slice((remainderParts[0] ?? "").length).trimStart();
  }

  const hasRemainder = remainder.length > 0;
  const nextText = `${leadingWhitespace}${suggestion}${
    hasRemainder ? ` ${remainder}` : ""
  }`;
  const cursorPosition =
    `${leadingWhitespace}${suggestion}`.length + (hasRemainder ? 1 : 0);

  return { text: nextText, cursorPosition };
}

export default function ScriptEditor() {
  const navigate = useNavigate();

  const {
    blocks,
    setBlocks,
    saveScript,
    title,
    setTitle,
    titlePage,
    setTitlePage,
    setScriptId,
    userId,
    markUnsynced,
  } = useScriptStore();

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const [showTitlePage, setShowTitlePage] = useState(false);
  const [showFormatTips, setShowFormatTips] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FORMAT_TIPS_STORAGE_KEY) === "true";
  });
  const [typewriterMode, setTypewriterMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(TYPEWRITER_MODE_STORAGE_KEY) === "true";
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFormatSettings, setShowFormatSettings] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [revisionMode] = useState(false);
  const [currentRevisionColor] = useState<RevisionColor>("blue");

  const [format, setFormat] = useState<FormatSettings>(defaultFormat);

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeTitlePage: true,
    includeSceneNumbers: true,
    includeMetadata: true,
    fileName: title || "Untitled Script",
  });

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaving = useRef(false);
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const workspaceRef = useRef<HTMLElement | null>(null);
  const pendingScrollTop = useRef<number | null>(null);
  const pendingFocusBlockId = useRef<string | null>(null);
  const pendingCursorPosition = useRef<{ id: string; position: number } | null>(
    null
  );
  const [suggestionHighlightByBlock, setSuggestionHighlightByBlock] = useState<
    Record<string, number>
  >({});
  const [suggestionIntentByBlock, setSuggestionIntentByBlock] = useState<
    Record<string, boolean>
  >({});
  const [dismissedSuggestionBlockId, setDismissedSuggestionBlockId] = useState<
    string | null
  >(null);
  const [textareaHeightByBlock, setTextareaHeightByBlock] = useState<
    Record<string, number>
  >({});

  const updateTextareaHeight = useCallback((blockId: string, height: number) => {
    const roundedHeight = Math.max(0, Math.round(height));
    setTextareaHeightByBlock((current) => {
      if (current[blockId] === roundedHeight) return current;
      return { ...current, [blockId]: roundedHeight };
    });
  }, []);

  const remeasureVisibleTextareas = useCallback(() => {
    setTextareaHeightByBlock((current) => {
      let changed = false;
      const next = { ...current };

      textareaRefs.current.forEach((textarea, blockId) => {
        const measuredHeight = Math.max(0, Math.round(resizeTextarea(textarea)));
        if (next[blockId] !== measuredHeight) {
          next[blockId] = measuredHeight;
          changed = true;
        }
      });

      Object.keys(next).forEach((blockId) => {
        if (!textareaRefs.current.has(blockId)) {
          delete next[blockId];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, []);

  const blockHasVisibleSuggestions = useCallback(
    (blockId: string, textOverride?: string) => {
      if (dismissedSuggestionBlockId === blockId) return false;
      const block = blocks.find((candidate) => candidate.id === blockId);
      if (!block) return false;

      const suggestionBlock =
        typeof textOverride === "string" ? { ...block, text: textOverride } : block;
      const suggestions = getBlockSuggestions(suggestionBlock, blocks);
      return Boolean(suggestions && suggestions.options.length > 0);
    },
    [blocks, dismissedSuggestionBlockId]
  );

  const scrollTextareaIntoView = useCallback(
    (
      textarea: HTMLTextAreaElement,
      options?: { preferTypewriter?: boolean }
    ) => {
      if (typeof window === "undefined") return;

      const preferTypewriter = options?.preferTypewriter === true;
      const workspace = workspaceRef.current;

      if (workspace && workspace.scrollHeight > workspace.clientHeight) {
        const workspaceRect = workspace.getBoundingClientRect();
        const rect = textarea.getBoundingClientRect();

        if (preferTypewriter) {
          const targetTop =
            workspaceRect.top + workspace.clientHeight * TYPEWRITER_TARGET_RATIO;
          const delta = rect.top - targetTop;
          if (Math.abs(delta) > 8) {
            workspace.scrollTop += delta;
          }
          return;
        }

        const viewportTop = workspaceRect.top + 14;
        const viewportBottom = workspaceRect.bottom - 14;
        if (rect.top < viewportTop) {
          workspace.scrollTop -= viewportTop - rect.top;
        } else if (rect.bottom > viewportBottom) {
          workspace.scrollTop += rect.bottom - viewportBottom;
        }
        return;
      }

      const rect = textarea.getBoundingClientRect();
      if (preferTypewriter) {
        const targetTop = window.innerHeight * TYPEWRITER_TARGET_RATIO;
        const delta = rect.top - targetTop;
        if (Math.abs(delta) > 8) {
          window.scrollBy({ top: delta, behavior: "auto" });
        }
        return;
      }

      const viewportTop = 96;
      const viewportBottom = window.innerHeight - 56;
      if (rect.top < viewportTop) {
        window.scrollBy({ top: rect.top - viewportTop - 12, behavior: "auto" });
      } else if (rect.bottom > viewportBottom) {
        window.scrollBy({ top: rect.bottom - viewportBottom + 12, behavior: "auto" });
      }
    },
    []
  );

  const focusTextareaAtPosition = useCallback(
    (
      textarea: HTMLTextAreaElement,
      position: number,
      options?: { blockId?: string }
    ) => {
      const safePosition = Math.max(0, Math.min(position, textarea.value.length));
      const hasSuggestions =
        options?.blockId ? blockHasVisibleSuggestions(options.blockId) : false;

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(safePosition, safePosition);
      scrollTextareaIntoView(textarea, {
        preferTypewriter: typewriterMode && !hasSuggestions,
      });
    },
    [blockHasVisibleSuggestions, scrollTextareaIntoView, typewriterMode]
  );

  const effectiveActiveBlockId = activeBlockId ?? blocks[0]?.id ?? null;
  const activeBlock = blocks.find((block) => block.id === effectiveActiveBlockId);
  const safePageHeightInches =
    typeof format.pageHeight === "number" &&
    Number.isFinite(format.pageHeight) &&
    format.pageHeight > 0
      ? format.pageHeight
      : 11;
  const safeFontSizePt =
    typeof format.fontSize === "number" &&
    Number.isFinite(format.fontSize) &&
    format.fontSize > 0
      ? format.fontSize
      : 12;
  const safeLineHeight =
    typeof format.lineHeight === "number" &&
    Number.isFinite(format.lineHeight) &&
    format.lineHeight > 0
      ? format.lineHeight
      : 1.25;
  const visualPageHeightPx = Math.max(
    VISUAL_PAGE_MIN_HEIGHT_PX,
    Math.round(safePageHeightInches * INCH_PX)
  );
  const visualPageContentHeightPx = Math.max(
    1,
    visualPageHeightPx - VISUAL_PAGE_VERTICAL_PADDING_PX
  );
  const fontSizePx = Math.max(12, safeFontSizePt) * (INCH_PX / 72);
  const lineHeightPx = Math.max(1.2, safeLineHeight) * fontSizePx;

  const scenes = useMemo(
    () =>
      blocks.filter(
        (block) => isSceneHeadingType(block.type) && block.text.trim().length > 0
      ),
    [blocks]
  );


  const resolvedTitlePage = useMemo<TitlePageData>(
    () => ({
      ...titlePage,
      title: titlePage.title.trim() || title || "Untitled Script",
    }),
    [titlePage, title]
  );

  const effectiveFileName =
    exportSettings.fileName.trim() &&
    exportSettings.fileName !== "Untitled Script"
      ? exportSettings.fileName
      : title || "Untitled Script";

  const resolvedExportSettings = useMemo<ExportSettings>(
    () => ({
      ...exportSettings,
      fileName: effectiveFileName,
    }),
    [exportSettings, effectiveFileName]
  );

  const exportInput = useMemo(
    () => ({
      blocks,
      title,
      titlePage: resolvedTitlePage,
      exportSettings: resolvedExportSettings,
    }),
    [blocks, title, resolvedTitlePage, resolvedExportSettings]
  );

  const getBlockVisualHeightPx = useCallback(
    (block: ScriptBlock) => {
      const spacing = getBlockVerticalSpacing(block.type);
      const measuredTextareaHeight = textareaHeightByBlock[block.id];
      const fallbackContentHeight = Math.max(lineHeightPx, 18);
      const contentHeight =
        typeof measuredTextareaHeight === "number" && measuredTextareaHeight > 0
          ? measuredTextareaHeight
          : fallbackContentHeight;
      return contentHeight + spacing.marginTopPx + spacing.marginBottomPx;
    },
    [lineHeightPx, textareaHeightByBlock]
  );

  const visualPageBlockIndices = useMemo(() => {
    try {
      const pages: number[][] = [];
      let currentPage: number[] = [];
      let currentPageHeight = 0;

      blocks.forEach((block, index) => {
        const blockHeight = getBlockVisualHeightPx(block);
        const safeBlockHeight =
          Number.isFinite(blockHeight) && blockHeight > 0 ? blockHeight : lineHeightPx;
        const exceedsCurrentPage =
          currentPage.length > 0 &&
          currentPageHeight + safeBlockHeight > visualPageContentHeightPx;

        if (exceedsCurrentPage) {
          pages.push(currentPage);
          currentPage = [index];
          currentPageHeight = safeBlockHeight;
          return;
        }

        currentPage.push(index);
        currentPageHeight += safeBlockHeight;
      });

      if (currentPage.length > 0) {
        pages.push(currentPage);
      }

      const hasRenderableBlocks = pages.some((page) => page.length > 0);
      if (blocks.length > 0 && !hasRenderableBlocks) {
        return [blocks.map((_, index) => index)];
      }

      return pages.length > 0 ? pages : [[]];
    } catch (error) {
      console.error("Pagination fallback triggered", error);
      return blocks.length > 0 ? [blocks.map((_, index) => index)] : [[]];
    }
  }, [blocks, getBlockVisualHeightPx, lineHeightPx, visualPageContentHeightPx]);

  useLayoutEffect(() => {
    remeasureVisibleTextareas();
  }, [
    blocks,
    format.fontSize,
    format.lineHeight,
    format.characterIndent,
    format.dialogueIndent,
    format.dialogueWidth,
    remeasureVisibleTextareas,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      window.requestAnimationFrame(() => {
        remeasureVisibleTextareas();
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [remeasureVisibleTextareas]);

  useEffect(() => {
    if (blocks.length > 0) return;

    const fallbackBlock = createEmptySceneHeadingBlock();
    setBlocks([fallbackBlock]);
  }, [blocks, setBlocks]);

  useLayoutEffect(() => {
    const blockId = pendingFocusBlockId.current;
    if (!blockId) return;

    const textarea = textareaRefs.current.get(blockId);
    if (!textarea) return;

    if (pendingScrollTop.current !== null) {
      const workspace = workspaceRef.current;
      if (workspace && workspace.scrollHeight > workspace.clientHeight) {
        workspace.scrollTop = pendingScrollTop.current;
      } else {
        const scrollingElement = document.scrollingElement;
        if (scrollingElement) {
          scrollingElement.scrollTop = pendingScrollTop.current;
        }
      }
      pendingScrollTop.current = null;
    }

    const measuredHeight = resizeTextarea(textarea);
    updateTextareaHeight(blockId, measuredHeight);
    focusTextareaAtPosition(textarea, textarea.value.length, { blockId });
    pendingFocusBlockId.current = null;
  }, [blocks, activeBlockId, focusTextareaAtPosition, updateTextareaHeight]);

  useLayoutEffect(() => {
    const pending = pendingCursorPosition.current;
    if (!pending) return;

    const textarea = textareaRefs.current.get(pending.id);
    if (!textarea) return;

    focusTextareaAtPosition(textarea, pending.position, { blockId: pending.id });
    pendingCursorPosition.current = null;
  }, [blocks, activeBlockId, focusTextareaAtPosition]);

  function registerTextarea(id: string, textarea: HTMLTextAreaElement | null) {
    if (textarea) {
      textareaRefs.current.set(id, textarea);
      resizeTextarea(textarea);
    } else {
      textareaRefs.current.delete(id);
    }
  }

  function focusBlockAfterRender(id: string | null | undefined) {
    pendingFocusBlockId.current = id ?? null;
  }

  function focusBlockCursorAfterRender(
    id: string | null | undefined,
    position: number
  ) {
    if (!id) return;
    pendingCursorPosition.current = { id, position };
  }

  const runSave = useCallback(async () => {
    if (isSaving.current) return;

    try {
      isSaving.current = true;
      await saveScript();
    } catch {
      // saveScript owns the shared failure/offline status.
    } finally {
      isSaving.current = false;
    }
  }, [saveScript]);

  useEffect(() => {
    if (!blocks || blocks.length === 0) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(runSave, 800);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [blocks, title, titlePage, runSave]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FORMAT_TIPS_STORAGE_KEY,
      showFormatTips ? "true" : "false"
    );
  }, [showFormatTips]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      TYPEWRITER_MODE_STORAGE_KEY,
      typewriterMode ? "true" : "false"
    );
  }, [typewriterMode]);

  function closeMenus() {
    // Legacy desktop menu was removed; keep this as a shared extension hook.
  }

  function fileBaseName() {
    return (resolvedExportSettings.fileName || title || "Untitled Script")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim();
  }

  function updateTitle(value: string) {
    setTitle(value);
    setTitlePage((prev) => ({ ...prev, title: value }));
    markUnsynced();
  }

  function updateTitlePageField(
    field: keyof TitlePageData,
    value: string
  ) {
    setTitlePage((prev) => ({ ...prev, [field]: value }));
    markUnsynced();
  }

  function updateBlock(id: string, value: string) {
    const blockIndex = blocks.findIndex((block) => block.id === id);
    if (blockIndex < 0) return;

    const currentBlock = blocks[blockIndex];
    const detectedType = detectType(value, currentBlock.type);
    const nextRevisionColor =
      revisionMode && currentBlock.revisionColor === undefined
        ? currentRevisionColor
        : currentBlock.revisionColor;

    if (
      currentBlock.text === value &&
      currentBlock.type === detectedType &&
      currentBlock.revisionColor === nextRevisionColor
    ) {
      return;
    }

    const updated = [...blocks];
    updated[blockIndex] = {
      ...currentBlock,
      text: value,
      type: detectedType,
      revisionColor: nextRevisionColor,
    };
    setBlocks(updated);

    markUnsynced();
    setDismissedSuggestionBlockId((current) => (current === id ? null : current));
    setSuggestionIntentByBlock((state) => ({
      ...state,
      [id]: false,
    }));
  }

  function applySuggestionToBlock(
    id: string,
    suggestion: string,
    kind: BlockSuggestionKind
  ) {
    let nextText = suggestion;
    let cursorPosition = suggestion.length;

    setBlocks(
      blocks.map((block) => {
        if (block.id !== id) return block;

        if (kind === "scene_heading") {
          const applied = replaceLeadingQuery(block.text, suggestion);
          nextText = applied.text;
          cursorPosition = applied.cursorPosition;
          return {
            ...block,
            type: "scene_heading",
            text: nextText,
          };
        }

        if (kind === "scene_heading_suffix") {
          const currentText = block.text.toUpperCase();
          const existingSuffix = SCENE_TIME_SUFFIXES.find((suffix) =>
            currentText.endsWith(suffix)
          );
          const withoutKnownSuffix = existingSuffix
            ? block.text.slice(0, block.text.length - existingSuffix.length)
            : block.text;
          const withoutPartialSuffix = withoutKnownSuffix.replace(/\s-\s?[A-Za-z]*$/, "");
          nextText = `${withoutPartialSuffix.trimEnd()}${suggestion}`;
          cursorPosition = nextText.length;
          return {
            ...block,
            type: "scene_heading",
            text: nextText,
          };
        }

        if (kind === "transition") {
          const applied = replaceLeadingQuery(block.text, suggestion);
          nextText = applied.text;
          cursorPosition = applied.cursorPosition;
          return {
            ...block,
            type: "transition",
            text: nextText,
          };
        }

        if (kind === "character") {
          const applied = replaceLeadingQuery(block.text, suggestion);
          nextText = applied.text;
          cursorPosition = applied.cursorPosition;
          return {
            ...block,
            type: "character",
            text: nextText,
          };
        }

        const applied = replaceLeadingQuery(block.text, suggestion);
        nextText = applied.text;
        cursorPosition = applied.cursorPosition;
        return {
          ...block,
          type: "shot",
          text: nextText,
        };
      })
    );
    pendingCursorPosition.current = { id, position: cursorPosition };
    setActiveBlockId(id);
    setSuggestionHighlightByBlock((state) => ({ ...state, [id]: 0 }));
    setSuggestionIntentByBlock((state) => ({ ...state, [id]: false }));
    setDismissedSuggestionBlockId(null);
    markUnsynced();
  }

  function updateBlockType(id: string, type: ScriptBlock["type"]) {
    const blockIndex = blocks.findIndex((block) => block.id === id);
    if (blockIndex < 0) return;

    const currentBlock = blocks[blockIndex];
    const nextRevisionColor =
      revisionMode && !currentBlock.revisionColor
        ? currentRevisionColor
        : currentBlock.revisionColor;

    if (
      currentBlock.type === type &&
      currentBlock.revisionColor === nextRevisionColor
    ) {
      return;
    }

    const updated = [...blocks];
    updated[blockIndex] = {
      ...currentBlock,
      type,
      revisionColor: nextRevisionColor,
    };
    setBlocks(updated);
    markUnsynced();
    setDismissedSuggestionBlockId((current) => (current === id ? null : current));
  }

  async function createNewScript() {
    if (!userId) {
      alert("You need to be logged in first.");
      return;
    }

    const newId = crypto.randomUUID();

    const newBlocks: ScriptBlock[] = [createEmptySceneHeadingBlock()];

    await supabase.from("scripts").insert({
      id: newId,
      user_id: userId,
      title: "Untitled Script",
      blocks: newBlocks,
      title_page: {
        title: "Untitled Script",
        writtenBy: "",
        basedOn: "",
        contact: "",
        draftDate: new Date().toLocaleDateString(),
      },
      updated_at: Date.now(),
    });

    setScriptId(newId);
    setTitle("Untitled Script");
    setTitlePage({
      title: "Untitled Script",
      writtenBy: "",
      basedOn: "",
      contact: "",
      draftDate: new Date().toLocaleDateString(),
    });
    setBlocks(newBlocks);
    setActiveBlockId(newBlocks[0]?.id ?? null);
    navigate(`/script/${newId}`);
    closeMenus();
  }

  async function saveNow() {
    await runSave();
    closeMenus();
  }

  function exportFountain() {
    downloadText(
      `${fileBaseName()}.fountain`,
      buildFountain(exportInput),
      "text/plain"
    );
    closeMenus();
  }

  function exportPlainText() {
    downloadText(`${fileBaseName()}.txt`, buildPlainText(exportInput), "text/plain");
    closeMenus();
  }

  function exportRtf() {
    downloadText(`${fileBaseName()}.rtf`, buildRtf(exportInput), "application/rtf");
    closeMenus();
  }

  function exportFdx() {
    downloadText(`${fileBaseName()}.fdx`, buildFdx(exportInput), "application/xml");
    closeMenus();
  }

  async function exportPdf() {
    const blob = await buildPdfBlob({
      ...exportInput,
      format,
      pageBlockIndices: visualPageBlockIndices,
    });
    downloadBlob(`${fileBaseName()}.pdf`, blob);
    closeMenus();
  }

  async function printScript() {
    const blob = await buildPdfBlob({
      ...exportInput,
      format,
      pageBlockIndices: visualPageBlockIndices,
    });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");

    if (!printWindow) {
      alert("Popup blocked. Allow popups to print the PDF.");
      return;
    }

    closeMenus();
  }

  function resetFormatDefaults() {
    setFormat(defaultFormat);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const current = blocks[index];
    const selectionStart = e.currentTarget.selectionStart ?? 0;
    const selectionEnd = e.currentTarget.selectionEnd ?? 0;
    const activeSuggestions =
      dismissedSuggestionBlockId === current.id
        ? null
        : getBlockSuggestions(current, blocks);
    const highlightedIndex =
      suggestionHighlightByBlock[current.id] !== undefined
        ? suggestionHighlightByBlock[current.id]
        : 0;
    const hasSuggestionIntent = suggestionIntentByBlock[current.id] === true;
    const clampedSuggestionIndex =
      activeSuggestions && activeSuggestions.options.length > 0
        ? Math.max(
            0,
            Math.min(highlightedIndex, activeSuggestions.options.length - 1)
          )
        : 0;

    const acceptActiveSuggestion = (trigger: "tab" | "enter") => {
      if (!activeSuggestions || activeSuggestions.options.length === 0) {
        return false;
      }

      const defaultSuggestionIndex = hasSuggestionIntent ? clampedSuggestionIndex : 0;
      let suggestionIndex = defaultSuggestionIndex;
      const selectedSuggestion = activeSuggestions.options[defaultSuggestionIndex];
      if (!selectedSuggestion) {
        return false;
      }

      const canAcceptOnTab = hasStrongSuggestionPrefixMatch(
        activeSuggestions.kind,
        current.text,
        selectedSuggestion
      ) && !isExactKnownSuggestion(activeSuggestions.kind, current.text, blocks);

      if (activeSuggestions.kind === "character") {
        const normalizedQuery = normalizeCharacterCue(current.text);
        const firstSuggestion = activeSuggestions.options[0];
        const hasStrongPrefixMatch =
          normalizedQuery.length >= 1 &&
          !!firstSuggestion &&
          normalizeCharacterCue(firstSuggestion).startsWith(normalizedQuery);
        const shouldAcceptCharacterSuggestion =
          hasSuggestionIntent || hasStrongPrefixMatch;

        if (trigger === "tab" && !canAcceptOnTab) {
          setSuggestionIntentByBlock((state) => ({
            ...state,
            [current.id]: false,
          }));
          return false;
        }

        if (trigger === "enter" && !shouldAcceptCharacterSuggestion) {
          if (trigger === "enter") {
            setDismissedSuggestionBlockId(current.id);
          }
          setSuggestionIntentByBlock((state) => ({
            ...state,
            [current.id]: false,
          }));
          return false;
        }

        if (!hasSuggestionIntent) {
          suggestionIndex = 0;
        }
      } else if (trigger === "tab" && !canAcceptOnTab) {
        setSuggestionIntentByBlock((state) => ({
          ...state,
          [current.id]: false,
        }));
        return false;
      }

      applySuggestionToBlock(
        current.id,
        activeSuggestions.options[suggestionIndex],
        activeSuggestions.kind
      );
      setSuggestionIntentByBlock((state) => ({
        ...state,
        [current.id]: false,
      }));
      return true;
    };

    if (current.locked) {
      if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
      }
      return;
    }

    if (activeSuggestions && activeSuggestions.options.length > 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedSuggestionBlockId(current.id);
        setSuggestionIntentByBlock((state) => ({
          ...state,
          [current.id]: false,
        }));
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIntentByBlock((state) => ({
          ...state,
          [current.id]: true,
        }));
        setSuggestionHighlightByBlock((state) => ({
          ...state,
          [current.id]:
            (clampedSuggestionIndex + 1) % activeSuggestions.options.length,
        }));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIntentByBlock((state) => ({
          ...state,
          [current.id]: true,
        }));
        setSuggestionHighlightByBlock((state) => ({
          ...state,
          [current.id]:
            (clampedSuggestionIndex - 1 + activeSuggestions.options.length) %
            activeSuggestions.options.length,
        }));
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();

      if (acceptActiveSuggestion("tab")) return;

      const nextType = e.shiftKey
        ? getPreviousType(current.type)
        : getNextType(current.type);

      pendingCursorPosition.current = {
        id: current.id,
        position: e.currentTarget.selectionStart ?? current.text.length,
      };
      updateBlockType(current.id, nextType);
      setActiveBlockId(current.id);
      return;
    }

    if (e.key === "ArrowUp") {
      if (selectionStart === 0 && selectionEnd === 0 && index > 0) {
        e.preventDefault();
        const previousBlock = blocks[index - 1];
        if (!previousBlock) return;
        setActiveBlockId(previousBlock.id);
        focusBlockCursorAfterRender(previousBlock.id, previousBlock.text.length);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      if (
        selectionStart === current.text.length &&
        selectionEnd === current.text.length &&
        index < blocks.length - 1
      ) {
        e.preventDefault();
        const nextBlock = blocks[index + 1];
        if (!nextBlock) return;
        setActiveBlockId(nextBlock.id);
        focusBlockCursorAfterRender(nextBlock.id, 0);
      }
      return;
    }

    if (e.key === "Enter") {
      if (e.shiftKey) {
        return;
      }

      if (acceptActiveSuggestion("enter")) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      const nextType = predictNextType(current.type);
      const newBlock: ScriptBlock = {
        id: crypto.randomUUID(),
        type: nextType,
        text: "",
        revisionColor: revisionMode ? currentRevisionColor : "none",
        locked: false,
        note: "",
      };

      const workspace = workspaceRef.current;
      if (workspace && workspace.scrollHeight > workspace.clientHeight) {
        pendingScrollTop.current = workspace.scrollTop;
      } else {
        pendingScrollTop.current = document.scrollingElement?.scrollTop ?? window.scrollY;
      }

      const updated = [...blocks];
      updated.splice(index + 1, 0, newBlock);

      setBlocks(updated);
      focusBlockAfterRender(newBlock.id);
      setActiveBlockId(newBlock.id);
      setDismissedSuggestionBlockId(null);
      markUnsynced();
      return;
    }

    if (e.key === "Backspace") {
      if (current.text.trim() === "" && blocks.length > 1) {
        e.preventDefault();
        const updated = blocks.filter((_, blockIndex) => blockIndex !== index);
        const previousBlock = updated[Math.max(0, index - 1)] ?? null;
        setBlocks(updated);
        if (previousBlock) {
          setActiveBlockId(previousBlock.id);
          focusBlockCursorAfterRender(previousBlock.id, previousBlock.text.length);
        } else {
          setActiveBlockId(null);
        }
        markUnsynced();
        return;
      }

      if (
        selectionStart === 0 &&
        selectionEnd === 0 &&
        index > 0 &&
        blocks.length > 1
      ) {
        const previousBlock = blocks[index - 1];
        if (!previousBlock || previousBlock.locked) return;

        e.preventDefault();
        const mergedText = `${previousBlock.text}${current.text}`;
        const previousEnd = previousBlock.text.length;

        const updated = blocks
          .map((block, blockIndex) =>
            blockIndex === index - 1 ? { ...block, text: mergedText } : block
          )
          .filter((_, blockIndex) => blockIndex !== index);

        setBlocks(updated);
        setActiveBlockId(previousBlock.id);
        focusBlockCursorAfterRender(previousBlock.id, previousEnd);
        markUnsynced();
      }
    }
  }

  function renderBlock(block: ScriptBlock, index: number) {
    const sceneIndex = scenes.findIndex((scene) => scene.id === block.id);
    const isActiveBlock = block.id === effectiveActiveBlockId;
    const showRevisionBackground =
      revisionMode &&
      block.revisionColor !== undefined &&
      block.revisionColor !== "none";
    const isSceneHeading = isSceneHeadingType(block.type);
    const isCharacter = block.type === "character";
    const isParenthetical = block.type === "parenthetical";
    const isDialogue = block.type === "dialogue";
    const isTransition = block.type === "transition";
    const isShot = block.type === "shot";
    const isUppercase =
      isSceneHeading || isCharacter || isTransition || isShot;
    const contentWidthPx = VISUAL_PAGE_CONTENT_WIDTH_PX;
    const actionWidthPx = contentWidthPx;
    const characterIndentPx = Math.max(
      0,
      (format.characterIndent - format.leftMargin) * INCH_PX
    );
    const characterWidthPx = Math.min(
      contentWidthPx - characterIndentPx,
      2.5 * INCH_PX
    );
    const dialogueIndentPx = Math.max(
      0,
      (format.dialogueIndent - format.leftMargin) * INCH_PX
    );
    const dialogueWidthPx = Math.min(contentWidthPx - dialogueIndentPx, format.dialogueWidth * INCH_PX);
    const parentheticalIndentPx = Math.max(0, (3 - format.leftMargin) * INCH_PX);
    const parentheticalWidthPx = Math.min(contentWidthPx - parentheticalIndentPx, 2.5 * INCH_PX);
    const blockSpacing = getBlockVerticalSpacing(block.type);

    const blockWidth = isCharacter
      ? `${characterWidthPx}px`
      : isParenthetical
        ? `${parentheticalWidthPx}px`
        : isDialogue
          ? `${dialogueWidthPx}px`
          : `${actionWidthPx}px`;
    const blockTextAlign = isTransition ? "right" : "left";
    const suggestions =
      isActiveBlock && dismissedSuggestionBlockId !== block.id
        ? getBlockSuggestions(block, blocks)
        : null;
    const highlightedIndex =
      suggestionHighlightByBlock[block.id] !== undefined
        ? suggestionHighlightByBlock[block.id]
        : 0;

    const textareaElement = (
      <div className="relative">
        <textarea
          value={block.text}
          disabled={block.locked}
          spellCheck
          ref={(textarea) => registerTextarea(block.id, textarea)}
        onFocus={(event) => {
          setActiveBlockId(block.id);
          setDismissedSuggestionBlockId(null);
          setSuggestionIntentByBlock((state) => ({
            ...state,
            [block.id]: false,
          }));

          if (typewriterMode && !blockHasVisibleSuggestions(block.id)) {
            window.requestAnimationFrame(() => {
              scrollTextareaIntoView(event.currentTarget, { preferTypewriter: true });
            });
          }
        }}
        onChange={(e) => {
          const measuredHeight = resizeTextarea(e.currentTarget);
          updateTextareaHeight(block.id, measuredHeight);
          updateBlock(block.id, e.target.value);

          if (typewriterMode && !blockHasVisibleSuggestions(block.id, e.target.value)) {
            window.requestAnimationFrame(() => {
              scrollTextareaIntoView(e.currentTarget, { preferTypewriter: true });
            });
          }
        }}
        onKeyDown={(e) => handleKeyDown(e, index)}
        rows={1}
        className="resize-none overflow-hidden rounded-sm bg-transparent outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-80"
        style={{
          width: blockWidth,
          marginTop: `${blockSpacing.marginTopIn}in`,
          marginBottom: `${blockSpacing.marginBottomIn}in`,
          marginLeft: isCharacter
            ? `${characterIndentPx}px`
            : isParenthetical
              ? `${parentheticalIndentPx}px`
              : isDialogue
                ? `${dialogueIndentPx}px`
                : "0px",
          marginRight: "0px",
          paddingLeft: "0in",
          fontWeight: isUppercase ? 700 : 400,
          fontStyle: isParenthetical ? "italic" : "normal",
          textAlign: blockTextAlign,
          textTransform: isUppercase ? "uppercase" : "none",
          fontFamily: '"Courier Prime", Courier, monospace',
          fontSize: `${Math.max(12, safeFontSizePt)}pt`,
          lineHeight: Math.max(1.2, safeLineHeight),
          background: showRevisionBackground
            ? revisionBackground(block.revisionColor)
            : elementBackground(block.type, isActiveBlock),
        }}
        placeholder={
          isSceneHeading
            ? "SCENE HEADING"
            : block.type === "parenthetical"
              ? "(parenthetical)"
              : block.type === "transition"
                ? "CUT TO:"
                : block.type === "shot"
                  ? "ANGLE ON:"
                  : block.type.toUpperCase()
        }
      />
        {suggestions && suggestions.options.length > 0 && (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-md border border-zinc-200/90 bg-white/95 p-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            {suggestions.options.map((suggestion, suggestionIndex) => (
              <button
                key={`${block.id}-${suggestion}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() =>
                  setSuggestionHighlightByBlock((state) => ({
                    ...state,
                    [block.id]: suggestionIndex,
                  }))
                }
                onClick={() =>
                  applySuggestionToBlock(block.id, suggestion, suggestions.kind)
                }
                className={`block w-full rounded-sm px-2.5 py-1.5 text-left text-xs text-zinc-700 transition-colors ${
                  suggestionIndex === highlightedIndex
                    ? "bg-zinc-100 text-zinc-900"
                    : "hover:bg-zinc-50"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div
        id={`block-${block.id}`}
        key={block.id}
        className="group relative rounded-sm"
      >
        {block.type !== "action" && (
          <span
            className="pointer-events-none absolute bottom-1 top-1 w-px"
            style={{
              left: "-0.12in",
              background: elementAccent(block.type),
            }}
          />
        )}

        {isActiveBlock && (
          <span
            className="absolute bottom-1 top-1 w-[2px] rounded-full bg-zinc-400/45"
            style={{ left: "-0.28in" }}
          />
        )}

        {isSceneHeading && format.showSceneNumbers && sceneIndex >= 0 && (
          <>
            <span className="absolute top-0 text-xs text-zinc-500" style={{ left: "-0.55in" }}>
              {sceneIndex + 1}.
            </span>
            <span className="absolute top-0 text-xs text-zinc-500" style={{ right: "-0.55in" }}>
              {sceneIndex + 1}.
            </span>
          </>
        )}

        <span
          className="absolute top-1 hidden rounded bg-zinc-100 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 group-hover:block"
          style={{ left: "-0.95in" }}
        >
          {blockTypeLabel(block.type)}
        </span>

        {block.note && (
          <span
            className="absolute top-7 hidden rounded bg-blue-100 px-2 py-1 text-[10px] text-blue-700 group-hover:block"
            style={{ left: "-0.95in" }}
          >
            note
          </span>
        )}

        {block.locked && (
          <span
            className="absolute top-13 hidden rounded bg-red-100 px-2 py-1 text-[10px] text-red-700 group-hover:block"
            style={{ left: "-0.95in" }}
          >
            locked
          </span>
        )}
        {textareaElement}
      </div>
    );
  }

  return (
    <AppLayout contentClassName="px-0 py-0 sm:px-0 sm:py-0">
      <div
        className="min-h-[calc(100vh-56px)] bg-zinc-50 text-zinc-950 font-sans"
      >
      <header className="sticky top-0 z-30 border-b border-zinc-200/90 bg-zinc-50/92 font-sans shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <ScriptToolbar
          activeElementType={activeBlock?.type || "action"}
          onChangeElementType={(type) => {
            if (effectiveActiveBlockId) {
              updateBlockType(effectiveActiveBlockId, type);
            }
          }}
          onBackToDashboard={() => navigate("/dashboard")}
          onNewScript={createNewScript}
          onSaveNow={saveNow}
          isTitlePageVisible={showTitlePage}
          onToggleTitlePage={() => setShowTitlePage((value) => !value)}
          isTypewriterMode={typewriterMode}
          onToggleTypewriterMode={() =>
            setTypewriterMode((currentValue) => !currentValue)
          }
          onOpenExportSettings={() => setShowExportSettings(true)}
          onPrint={printScript}
          showFormatTips={showFormatTips}
          onToggleFormatTips={() =>
            setShowFormatTips((currentValue) => !currentValue)
          }
        />
      </header>

      <section className="border-b border-zinc-200/90 bg-zinc-50 px-4 py-5 text-center">
        <div className="mx-auto flex w-full max-w-[960px] items-center justify-center">
          <div>
            <p className="mx-auto max-w-[900px] truncate text-sm font-semibold tracking-[0.1em] text-zinc-700">
              {(title || "Untitled Script").toUpperCase()}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              PageOne Script
            </p>
          </div>
        </div>
      </section>

      <div className="font-sans">
        <main
          ref={(element) => {
            workspaceRef.current = element;
          }}
          className="min-h-[calc(100vh-206px)] overflow-x-hidden overflow-y-auto px-3 py-5 font-sans sm:px-6 sm:py-7 lg:px-8 lg:py-9"
        >
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-10">
              {showTitlePage && (
                <section
                  className="w-full border border-zinc-300/90 bg-white text-black shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
                  style={{
                    width: `min(${VISUAL_PAGE_MAX_WIDTH_PX}px, calc(100vw - 2.5rem))`,
                    height: `${visualPageHeightPx}px`,
                    paddingTop: `${VISUAL_PAGE_PADDING_TOP_PX}px`,
                    paddingBottom: `${VISUAL_PAGE_PADDING_BOTTOM_PX}px`,
                    paddingLeft: `${VISUAL_PAGE_PADDING_LEFT_PX}px`,
                    paddingRight: `${VISUAL_PAGE_PADDING_RIGHT_PX}px`,
                    boxSizing: "border-box",
                    fontFamily: '"Courier Prime", Courier, monospace',
                  }}
                >
                  <div
                    className="mx-auto flex w-full flex-col"
                    style={{
                      height: `${visualPageContentHeightPx}px`,
                    }}
                  >
                    <div className="mx-auto mt-24 w-full max-w-[560px] text-center">
                      <input
                        value={titlePage.title}
                        onChange={(e) => updateTitle(e.target.value)}
                        className="w-full cursor-text appearance-none border-0 bg-transparent text-center text-[24px] font-semibold uppercase tracking-[0.1em] text-zinc-900 outline-none placeholder:text-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-400/50"
                        placeholder="UNTITLED SCRIPT"
                      />

                      <p className="mt-20 text-[13px] uppercase tracking-[0.18em] text-zinc-500">
                        Written by
                      </p>

                      <input
                        value={titlePage.writtenBy}
                        onChange={(e) =>
                          updateTitlePageField("writtenBy", e.target.value)
                        }
                        className="mx-auto mt-4 w-full max-w-[400px] cursor-text appearance-none border-0 bg-transparent text-center text-[18px] text-zinc-900 outline-none placeholder:text-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-400/50"
                        placeholder="Author Name"
                      />

                      <input
                        value={titlePage.basedOn}
                        onChange={(e) =>
                          updateTitlePageField("basedOn", e.target.value)
                        }
                        className="mx-auto mt-8 w-full max-w-[430px] cursor-text appearance-none border-0 bg-transparent text-center text-[12px] italic text-zinc-700 outline-none placeholder:text-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-400/50"
                        placeholder="Based on (optional)"
                      />
                    </div>

                    <div className="mt-auto grid grid-cols-1 gap-8 pt-20 text-[12px] sm:grid-cols-2">
                      <div className="text-left">
                        <textarea
                          value={titlePage.contact}
                          onChange={(e) =>
                            updateTitlePageField("contact", e.target.value)
                          }
                          className="h-28 w-full resize-none cursor-text appearance-none border-0 bg-transparent text-[13px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-400/50"
                          placeholder="contact@email.com&#10;+1 (555) 555-5555"
                        />
                      </div>

                      <div className="text-left sm:text-right">
                        <input
                          value={titlePage.draftDate}
                          onChange={(e) =>
                            updateTitlePageField("draftDate", e.target.value)
                          }
                          className="w-full cursor-text appearance-none border-0 bg-transparent text-left text-[13px] text-zinc-800 outline-none placeholder:text-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-400/50 sm:text-right"
                          placeholder="Draft date"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {visualPageBlockIndices.map((pageIndices, pageIndex) => (
                <section
                  key={`visual-page-${pageIndex}`}
                  className="w-full border border-zinc-300/90 bg-white text-black shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
                  style={{
                    width: `min(${VISUAL_PAGE_MAX_WIDTH_PX}px, calc(100vw - 2.5rem))`,
                    height: `${visualPageHeightPx}px`,
                    paddingTop: `${VISUAL_PAGE_PADDING_TOP_PX}px`,
                    paddingBottom: `${VISUAL_PAGE_PADDING_BOTTOM_PX}px`,
                    paddingLeft: `${VISUAL_PAGE_PADDING_LEFT_PX}px`,
                    paddingRight: `${VISUAL_PAGE_PADDING_RIGHT_PX}px`,
                    boxSizing: "border-box",
                    fontFamily: '"Courier Prime", Courier, monospace',
                    fontSize: `${Math.max(12, safeFontSizePt)}pt`,
                    lineHeight: Math.max(1.2, safeLineHeight),
                  }}
                >
                  <div
                    className="mx-auto"
                    style={{ width: `${VISUAL_PAGE_CONTENT_WIDTH_PX}px` }}
                  >
                    {pageIndices.map((blockIndex) => {
                      const block = blocks[blockIndex];
                      return block ? renderBlock(block, blockIndex) : null;
                    })}
                  </div>
                </section>
              ))}
            </div>

            {showFormatTips && (
              <div className="w-full lg:sticky lg:top-[152px] lg:w-[280px] lg:flex-none">
                <FormatTipsBox
                  activeType={activeBlock?.type ?? "action"}
                  onClose={() => setShowFormatTips(false)}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {showFormatSettings && (
        <Modal title="Format Settings" onClose={() => setShowFormatSettings(false)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField label="Page Width" value={format.pageWidth} onChange={(value) => setFormat({ ...format, pageWidth: value })} />
            <NumberField label="Page Height" value={format.pageHeight} onChange={(value) => setFormat({ ...format, pageHeight: value })} />
            <NumberField label="Top Margin" value={format.topMargin} onChange={(value) => setFormat({ ...format, topMargin: value })} />
            <NumberField label="Bottom Margin" value={format.bottomMargin} onChange={(value) => setFormat({ ...format, bottomMargin: value })} />
            <NumberField label="Left Margin" value={format.leftMargin} onChange={(value) => setFormat({ ...format, leftMargin: value })} />
            <NumberField label="Right Margin" value={format.rightMargin} onChange={(value) => setFormat({ ...format, rightMargin: value })} />
            <NumberField label="Font Size" value={format.fontSize} onChange={(value) => setFormat({ ...format, fontSize: value })} />
            <NumberField label="Line Height" value={format.lineHeight} onChange={(value) => setFormat({ ...format, lineHeight: value })} />
            <NumberField label="Character Position" value={format.characterIndent} onChange={(value) => setFormat({ ...format, characterIndent: value })} />
            <NumberField label="Dialogue Position" value={format.dialogueIndent} onChange={(value) => setFormat({ ...format, dialogueIndent: value })} />
            <NumberField label="Dialogue Width" value={format.dialogueWidth} onChange={(value) => setFormat({ ...format, dialogueWidth: value })} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={format.showSceneNumbers} onChange={(e) => setFormat({ ...format, showSceneNumbers: e.target.checked })} />
            Show scene numbers
          </label>

          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button onClick={resetFormatDefaults} className="rounded border border-zinc-300 px-4 py-2 text-sm font-bold">
              Reset Defaults
            </button>

            <button onClick={() => setShowFormatSettings(false)} className="rounded bg-zinc-900 px-4 py-2 text-sm font-bold text-white">
              Apply
            </button>
          </div>
        </Modal>
      )}

      {showExportSettings && (
        <Modal title="Export Settings" onClose={() => setShowExportSettings(false)}>
          <div className="space-y-3 text-sm">
            <TextField label="File Name" value={resolvedExportSettings.fileName} onChange={(value) => setExportSettings({ ...exportSettings, fileName: value })} />
            <CheckField label="Include title page" checked={exportSettings.includeTitlePage} onChange={(checked) => setExportSettings({ ...exportSettings, includeTitlePage: checked })} />
            <CheckField label="Include scene numbers" checked={exportSettings.includeSceneNumbers} onChange={(checked) => setExportSettings({ ...exportSettings, includeSceneNumbers: checked })} />
            <CheckField label="Include metadata" checked={exportSettings.includeMetadata} onChange={(checked) => setExportSettings({ ...exportSettings, includeMetadata: checked })} />

            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              <button onClick={exportFdx} className="rounded bg-zinc-900 px-4 py-2 font-bold text-white">Export FDX</button>
              <button onClick={exportPdf} className="rounded bg-zinc-900 px-4 py-2 font-bold text-white">Export PDF</button>
              <button onClick={exportFountain} className="rounded border border-zinc-300 px-4 py-2 font-bold">Export Fountain</button>
              <button onClick={exportRtf} className="rounded border border-zinc-300 px-4 py-2 font-bold">Export RTF</button>
              <button onClick={exportPlainText} className="rounded border border-zinc-300 px-4 py-2 font-bold">Export TXT</button>
              <button onClick={printScript} className="rounded border border-zinc-300 px-4 py-2 font-bold">Print</button>
            </div>
          </div>
        </Modal>
      )}

      {showShortcuts && (
        <Modal title="Keyboard Shortcuts" onClose={() => setShowShortcuts(false)}>
          <div className="space-y-2 text-sm">
            <p><strong>Tab:</strong> Next element type</p>
            <p><strong>Shift + Tab:</strong> Previous element type</p>
            <p><strong>Enter:</strong> Create next screenplay element</p>
            <p><strong>Backspace on empty element:</strong> Delete element</p>
          </div>
        </Modal>
      )}

      {showAbout && (
        <Modal title="About Script Studio" onClose={() => setShowAbout(false)}>
          <p className="text-sm text-zinc-600">
            Script Studio is your cloud-based screenplay editor with professional-style formatting, revision colors, production tools, element notes, smart suggestions, exports, and customizable screenplay layout.
          </p>
        </Modal>
      )}
      </div>
    </AppLayout>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs font-bold text-zinc-600">
      {label}
      <input type="number" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm font-normal" />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block text-xs font-bold text-zinc-600">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm font-normal" />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4 font-sans sm:px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-white p-4 text-zinc-900 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900">
            Close
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
