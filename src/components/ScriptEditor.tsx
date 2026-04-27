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
const VISUAL_PAGE_BLOCKS = 22;
const VISUAL_PAGE_CONTENT_WIDTH_PX =
  VISUAL_PAGE_MAX_WIDTH_PX -
  VISUAL_PAGE_PADDING_LEFT_PX -
  VISUAL_PAGE_PADDING_RIGHT_PX;

type BlockSuggestionKind = "scene_heading" | "transition" | "shot";

type BlockSuggestionState = {
  kind: BlockSuggestionKind;
  options: string[];
};

const TRANSITION_PREFIX_HINTS = ["CUT", "FADE", "DISS", "MATCH", "SMASH"];
const SHOT_PREFIX_HINTS = ["CLOSE", "ANGLE", "POV", "INSERT", "WIDE", "TRACKING"];
const FORMAT_TIPS_STORAGE_KEY = "pageone:show-format-tips";

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
  if (!textarea) return;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function elementBackground(
  type: ScriptBlock["type"],
  isActive: boolean
): string {
  if (type === "scene_heading" || type === "scene") {
    return isActive ? "#f7f4ee" : "#fbfaf7";
  }
  if (type === "dialogue") return isActive ? "#f8f6f2" : "#fdfcf9";
  if (type === "parenthetical") return isActive ? "#f7f5f1" : "#fdfcfb";
  if (type === "transition") return isActive ? "#f6f4ef" : "#fbfaf7";
  if (type === "shot") return isActive ? "#f8f6f2" : "#fdfcf9";
  if (type === "character") return isActive ? "#f7f5f1" : "transparent";
  return isActive ? "#f8f6f2" : "transparent";
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

function getBlockSuggestions(block: ScriptBlock): BlockSuggestionState | null {
  const normalizedType = block.type === "scene" ? "scene_heading" : block.type;
  const query = block.text.trim().toUpperCase();

  if (normalizedType === "scene_heading") {
    if (!query || query.includes(" ")) return null;
    const options = sceneHeadingSuggestions
      .filter((suggestion) => suggestion.startsWith(query))
      .filter((suggestion) => suggestion !== query);
    return options.length ? { kind: "scene_heading", options: [...options] } : null;
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
  const pendingFocusBlockId = useRef<string | null>(null);
  const pendingCursorPosition = useRef<{ id: string; position: number } | null>(
    null
  );
  const [suggestionHighlightByBlock, setSuggestionHighlightByBlock] = useState<
    Record<string, number>
  >({});
  const [dismissedSuggestionBlockId, setDismissedSuggestionBlockId] = useState<
    string | null
  >(null);

  const ensureTextareaVisible = useCallback((textarea: HTMLTextAreaElement) => {
    if (typeof window === "undefined") return;

    const viewportTop = 96;
    const viewportBottom = window.innerHeight - 56;
    const rect = textarea.getBoundingClientRect();

    if (rect.top < viewportTop || rect.bottom > viewportBottom) {
      textarea.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, []);

  const focusTextareaAtPosition = useCallback(
    (textarea: HTMLTextAreaElement, position: number) => {
      const safePosition = Math.max(0, Math.min(position, textarea.value.length));

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(safePosition, safePosition);
      ensureTextareaVisible(textarea);
    },
    [ensureTextareaVisible]
  );

  const effectiveActiveBlockId = activeBlockId ?? blocks[0]?.id ?? null;
  const activeBlock = blocks.find((block) => block.id === effectiveActiveBlockId);

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

  const visualPageBlockIndices = useMemo(() => {
    const pages: number[][] = [[]];

    blocks.forEach((_, index) => {
      const currentPage = pages[pages.length - 1];

      if (currentPage.length >= VISUAL_PAGE_BLOCKS) {
        pages.push([index]);
        return;
      }

      currentPage.push(index);
    });

    return pages;
  }, [blocks]);

  useLayoutEffect(() => {
    const blockId = pendingFocusBlockId.current;
    if (!blockId) return;

    const textarea = textareaRefs.current.get(blockId);
    if (!textarea) return;

    resizeTextarea(textarea);
    focusTextareaAtPosition(textarea, textarea.value.length);
    pendingFocusBlockId.current = null;
  }, [blocks, activeBlockId, focusTextareaAtPosition]);

  useLayoutEffect(() => {
    const pending = pendingCursorPosition.current;
    if (!pending) return;

    const textarea = textareaRefs.current.get(pending.id);
    if (!textarea) return;

    focusTextareaAtPosition(textarea, pending.position);
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

    const newBlocks: ScriptBlock[] = [
      {
        id: crypto.randomUUID(),
        type: "action",
        text: "FADE IN:",
        revisionColor: "none",
        locked: false,
        note: "",
      },
    ];

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
    const blob = await buildPdfBlob({ ...exportInput, format });
    downloadBlob(`${fileBaseName()}.pdf`, blob);
    closeMenus();
  }

  async function printScript() {
    const blob = await buildPdfBlob({ ...exportInput, format });
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
        : getBlockSuggestions(current);
    const highlightedIndex =
      suggestionHighlightByBlock[current.id] !== undefined
        ? suggestionHighlightByBlock[current.id]
        : 0;
    const clampedSuggestionIndex =
      activeSuggestions && activeSuggestions.options.length > 0
        ? Math.max(
            0,
            Math.min(highlightedIndex, activeSuggestions.options.length - 1)
          )
        : 0;

    const acceptActiveSuggestion = () => {
      if (!activeSuggestions || activeSuggestions.options.length === 0) {
        return false;
      }

      applySuggestionToBlock(
        current.id,
        activeSuggestions.options[clampedSuggestionIndex],
        activeSuggestions.kind
      );
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
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionHighlightByBlock((state) => ({
          ...state,
          [current.id]:
            (clampedSuggestionIndex + 1) % activeSuggestions.options.length,
        }));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
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

      if (acceptActiveSuggestion()) return;

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

      if (acceptActiveSuggestion()) {
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
    const isAction = block.type === "action";
    const isGeneral = block.type === "general";
    const isParenthetical = block.type === "parenthetical";
    const isDialogue = block.type === "dialogue";
    const isTransition = block.type === "transition";
    const isShot = block.type === "shot";
    const isUppercase =
      isSceneHeading || isCharacter || isTransition || isShot;
    const usesCenteredColumn = isCharacter || isParenthetical || isDialogue;
    const dialogueColumnWidthPx = 336;
    const characterWidthPx = 300;
    const parentheticalWidthPx = 250;

    const blockWidth = isCharacter
      ? `${characterWidthPx}px`
      : isParenthetical
        ? `${parentheticalWidthPx}px`
        : isDialogue
          ? `${dialogueColumnWidthPx}px`
          : "100%";

    const blockMarginTop =
      isSceneHeading
        ? "0.28in"
        : isTransition
          ? "0.24in"
          : isShot
            ? "0.16in"
            : isCharacter
              ? "0.2in"
              : isParenthetical
                ? "0.02in"
                : isDialogue
                  ? "0.01in"
                  : isAction || isGeneral
                    ? "0.03in"
                    : "0in";
    const blockMarginBottom =
      isSceneHeading
        ? "0.1in"
        : isTransition
          ? "0.1in"
          : isShot
            ? "0.08in"
            : isCharacter
              ? "0.02in"
              : isParenthetical
                ? "0.03in"
                : isDialogue
                  ? "0.11in"
                  : isAction || isGeneral
                    ? "0.05in"
                    : "0in";
    const blockTextAlign = isCharacter ? "center" : isTransition ? "right" : "left";
    const parentheticalOffsetPx = -12;
    const suggestions =
      isActiveBlock && dismissedSuggestionBlockId !== block.id
        ? getBlockSuggestions(block)
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
        onFocus={() => {
          setActiveBlockId(block.id);
          setDismissedSuggestionBlockId(null);
        }}
        onChange={(e) => {
          resizeTextarea(e.currentTarget);
          updateBlock(block.id, e.target.value);
        }}
        onKeyDown={(e) => handleKeyDown(e, index)}
        rows={1}
        className="resize-none overflow-hidden rounded-sm bg-transparent outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-80"
        style={{
          width: blockWidth,
          marginTop: blockMarginTop,
          marginBottom: blockMarginBottom,
          marginLeft: usesCenteredColumn
            ? isCharacter
              ? "auto"
              : isParenthetical
              ? `${parentheticalOffsetPx}px`
              : "0px"
            : "0px",
          marginRight: usesCenteredColumn
            ? isCharacter || isParenthetical
              ? "auto"
              : "0px"
            : "0px",
          paddingLeft: isParenthetical ? "0.1in" : "0in",
          fontWeight: isUppercase ? 700 : 400,
          fontStyle: isParenthetical ? "italic" : "normal",
          textAlign: blockTextAlign,
          textTransform: isUppercase ? "uppercase" : "none",
          fontFamily: '"Courier Prime", Courier, monospace',
          fontSize: `${format.fontSize}pt`,
          lineHeight: format.lineHeight,
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
        className={`group relative rounded-sm transition-colors ${
          isActiveBlock ? "bg-zinc-100/55" : ""
        }`}
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
            className="absolute bottom-1 top-1 w-[3px] rounded-full bg-zinc-400/55"
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
        {usesCenteredColumn ? (
          <div
            className="mx-auto"
            style={{ width: `${dialogueColumnWidthPx}px` }}
          >
            {textareaElement}
          </div>
        ) : (
          textareaElement
        )}
      </div>
    );
  }

  return (
    <AppLayout contentClassName="px-0 py-0 sm:px-0 sm:py-0">
      <div
        className="min-h-[calc(100vh-56px)] bg-[radial-gradient(130%_65%_at_50%_0%,#f7f4ee_0%,#f1eee8_58%,#ebe7e0_100%)] text-zinc-950 font-sans"
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
          onOpenExportSettings={() => setShowExportSettings(true)}
          onPrint={printScript}
          showFormatTips={showFormatTips}
          onToggleFormatTips={() =>
            setShowFormatTips((currentValue) => !currentValue)
          }
        />
      </header>

      <section className="border-b border-zinc-200/90 bg-zinc-50/85 px-4 py-5 text-center">
        <div className="relative mx-auto flex w-full max-w-[960px] items-center justify-center">
          <div>
            <p className="mx-auto max-w-[900px] truncate text-sm font-semibold tracking-[0.1em] text-zinc-700">
              {(title || "Untitled Script").toUpperCase()}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              PageOne Script
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTitlePage((value) => !value)}
            className="absolute right-4 rounded border border-zinc-200/90 bg-white/95 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50 sm:right-6"
          >
            {showTitlePage ? "Hide Title Page" : "Title Page"}
          </button>
        </div>
      </section>

      <div className="font-sans">
        <main className="min-h-[calc(100vh-206px)] overflow-x-hidden overflow-y-auto px-3 py-5 font-sans sm:px-6 sm:py-7 lg:px-8 lg:py-9">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-10">
              {showTitlePage && (
                <section
                  className="w-full border border-zinc-300/90 bg-white text-black shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
                  style={{
                    width: `min(${VISUAL_PAGE_MAX_WIDTH_PX}px, calc(100vw - 2.5rem))`,
                    minHeight: `${VISUAL_PAGE_MIN_HEIGHT_PX}px`,
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
                      minHeight: `${
                        VISUAL_PAGE_MIN_HEIGHT_PX -
                        VISUAL_PAGE_PADDING_TOP_PX -
                        VISUAL_PAGE_PADDING_BOTTOM_PX
                      }px`,
                    }}
                  >
                    <div className="mx-auto mt-20 w-full max-w-[540px] text-center">
                      <input
                        value={resolvedTitlePage.title}
                        onChange={(e) => updateTitle(e.target.value)}
                        className="w-full bg-transparent text-center text-[22px] font-semibold uppercase tracking-[0.08em] outline-none placeholder:text-zinc-300"
                        placeholder="UNTITLED SCRIPT"
                      />

                      <p className="mt-16 text-[13px] uppercase tracking-[0.18em] text-zinc-500">
                        Written by
                      </p>

                      <input
                        value={titlePage.writtenBy}
                        onChange={(e) =>
                          updateTitlePageField("writtenBy", e.target.value)
                        }
                        className="mx-auto mt-3 w-full max-w-[380px] bg-transparent text-center text-[17px] outline-none placeholder:text-zinc-300"
                        placeholder="Author Name"
                      />

                      <input
                        value={titlePage.basedOn}
                        onChange={(e) =>
                          updateTitlePageField("basedOn", e.target.value)
                        }
                        className="mx-auto mt-7 w-full max-w-[420px] bg-transparent text-center text-[12px] italic text-zinc-700 outline-none placeholder:text-zinc-300"
                        placeholder="Based on..."
                      />
                    </div>

                    <div className="mt-auto grid grid-cols-1 gap-6 pt-16 text-[12px] sm:grid-cols-2">
                      <div className="text-left">
                        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                          Contact
                        </p>
                        <textarea
                          value={titlePage.contact}
                          onChange={(e) =>
                            updateTitlePageField("contact", e.target.value)
                          }
                          className="h-28 w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-zinc-300"
                          placeholder="contact@email.com&#10;+1 (555) 555-5555"
                        />
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                          Draft Date
                        </p>
                        <input
                          value={titlePage.draftDate}
                          onChange={(e) =>
                            updateTitlePageField("draftDate", e.target.value)
                          }
                          className="w-full bg-transparent text-left outline-none placeholder:text-zinc-300 sm:text-right"
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
                    minHeight: `${VISUAL_PAGE_MIN_HEIGHT_PX}px`,
                    paddingTop: `${VISUAL_PAGE_PADDING_TOP_PX}px`,
                    paddingBottom: `${VISUAL_PAGE_PADDING_BOTTOM_PX}px`,
                    paddingLeft: `${VISUAL_PAGE_PADDING_LEFT_PX}px`,
                    paddingRight: `${VISUAL_PAGE_PADDING_RIGHT_PX}px`,
                    boxSizing: "border-box",
                    fontFamily: '"Courier Prime", Courier, monospace',
                    fontSize: `${format.fontSize}pt`,
                    lineHeight: format.lineHeight,
                  }}
                >
                  {pageIndex > 0 && (
                    <div className="mb-6 border-b border-zinc-200 pb-3 text-right text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                      Page {pageIndex + 1}
                    </div>
                  )}

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
