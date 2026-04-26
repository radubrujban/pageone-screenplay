import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
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
  revisionBackground,
  revisionColors,
} from "../lib/screenplayFormat";
import type {
  ExportSettings,
  FormatSettings,
  TitlePageData,
} from "../lib/screenplayFormat";
import AppLayout from "./AppLayout";
import ScriptToolbar from "./ScriptToolbar";
import { useScriptStore } from "../store/useScriptStore";
import type { RevisionColor, ScriptBlock } from "../types/script";

type MenuName =
  | "file"
  | "edit"
  | "view"
  | "insert"
  | "tools"
  | "production"
  | "help"
  | null;

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
  if (type === "scene") return isActive ? "#f8fbff" : "#fbfdff";
  if (type === "dialogue") return isActive ? "#fafafa" : "#fdfdfd";
  if (type === "character") return isActive ? "#fbfbfb" : "transparent";
  return isActive ? "#fcfcfc" : "transparent";
}

function elementAccent(type: ScriptBlock["type"]) {
  if (type === "scene") return "#bfdbfe";
  if (type === "dialogue") return "#e5e7eb";
  if (type === "character") return "#d4d4d8";
  return "transparent";
}

export default function ScriptEditor() {
  const navigate = useNavigate();

  const {
    blocks,
    setBlocks,
    saveScript,
    title,
    setTitle,
    setScriptId,
    userId,
    markUnsynced,
  } = useScriptStore();

  const [activeMenu, setActiveMenu] = useState<MenuName>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const [showNavigator, setShowNavigator] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState<
    "stats" | "feedback" | "notes" | "suggestions"
  >("stats");

  const [showTitlePage, setShowTitlePage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFormatSettings, setShowFormatSettings] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [productionMode, setProductionMode] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const [currentRevisionColor] = useState<RevisionColor>("blue");
  const [focusMode, setFocusMode] = useState(false);
  const [pageScale, setPageScale] = useState(1);

  const [feedback, setFeedback] = useState(
    "Click Analyze Script to generate basic writing feedback."
  );

  const [format, setFormat] = useState<FormatSettings>(defaultFormat);

  const [titlePage, setTitlePage] = useState<TitlePageData>({
    title: "",
    writtenBy: "",
    basedOn: "",
    contact: "",
    draftDate: new Date().toLocaleDateString(),
  });

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

  const effectiveActiveBlockId = activeBlockId ?? blocks[0]?.id ?? null;
  const activeBlock = blocks.find((block) => block.id === effectiveActiveBlockId);
  const activeIndex = blocks.findIndex(
    (block) => block.id === effectiveActiveBlockId
  );

  const scenes = useMemo(
    () =>
      blocks.filter(
        (block) => block.type === "scene" && block.text.trim().length > 0
      ),
    [blocks]
  );

  const notes = useMemo(
    () => blocks.filter((block) => block.note && block.note.trim().length > 0),
    [blocks]
  );

  const stats = useMemo(() => {
    const words = blocks
      .map((block) => block.text.trim())
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;

    return {
      scenes: scenes.length,
      blocks: blocks.length,
      words,
      characters: blocks.filter((block) => block.type === "character").length,
      dialogue: blocks.filter((block) => block.type === "dialogue").length,
      notes: notes.length,
      locked: blocks.filter((block) => block.locked).length,
      revisions: blocks.filter(
        (block) => block.revisionColor && block.revisionColor !== "none"
      ).length,
      estimatedPages: Math.max(1, Math.ceil(blocks.length / 45)),
    };
  }, [blocks, scenes.length, notes.length]);

  const smartSuggestions = useMemo(() => {
    const suggestions: {
      label: string;
      type: ScriptBlock["type"];
      text?: string;
      helper: string;
    }[] = [];

    if (!activeBlock) {
      suggestions.push({
        label: "Start with FADE IN:",
        type: "action",
        text: "FADE IN:",
        helper: "Classic opening text",
      });
      suggestions.push({
        label: "Add Scene Heading",
        type: "scene",
        text: "INT. LOCATION - DAY",
        helper: "Create your first slugline",
      });
      return suggestions;
    }

    if (activeBlock.type === "scene") {
      suggestions.push({
        label: "Add Action",
        type: "action",
        helper: "Describe what we see after the scene heading",
      });
      suggestions.push({
        label: "Add Shot",
        type: "action",
        text: "ANGLE ON:",
        helper: "Direct attention visually",
      });
    }

    if (activeBlock.type === "action") {
      suggestions.push({
        label: "Add Character",
        type: "character",
        helper: "Start dialogue with a speaker cue",
      });
      suggestions.push({
        label: "Add New Scene",
        type: "scene",
        text: "INT. LOCATION - DAY",
        helper: "Move the story to a new location/time",
      });
    }

    if (activeBlock.type === "character") {
      suggestions.push({
        label: "Add Dialogue",
        type: "dialogue",
        helper: "Write what the character says",
      });
      suggestions.push({
        label: "Add Parenthetical",
        type: "dialogue",
        text: "(quietly)",
        helper: "Small performance direction",
      });
    }

    if (activeBlock.type === "dialogue") {
      suggestions.push({
        label: "Add Action",
        type: "action",
        helper: "Break up dialogue with behavior",
      });
      suggestions.push({
        label: "Add Character Reply",
        type: "character",
        helper: "Continue the conversation",
      });
    }

    return suggestions;
  }, [activeBlock]);

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

  useLayoutEffect(() => {
    const blockId = pendingFocusBlockId.current;
    if (!blockId) return;

    const textarea = textareaRefs.current.get(blockId);
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    resizeTextarea(textarea);
    pendingFocusBlockId.current = null;
  }, [blocks, activeBlockId]);

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
  }, [blocks, title, runSave]);

  function closeMenus() {
    setActiveMenu(null);
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

  function updateBlock(id: string, value: string) {
    setBlocks(
      blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              text: value,
              type: detectType(value, block.type),
              revisionColor:
                revisionMode && block.revisionColor === undefined
                  ? currentRevisionColor
                  : block.revisionColor,
            }
          : block
      )
    );

    markUnsynced();
  }

  function updateBlockType(id: string, type: ScriptBlock["type"]) {
    setBlocks(
      blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              type,
              revisionColor:
                revisionMode && !block.revisionColor
                  ? currentRevisionColor
                  : block.revisionColor,
            }
          : block
      )
    );
    markUnsynced();
  }

  function updateBlockNote(id: string, note: string) {
    setBlocks(
      blocks.map((block) => (block.id === id ? { ...block, note } : block))
    );
    markUnsynced();
  }

  function updateBlockRevision(id: string, color: RevisionColor) {
    setBlocks(
      blocks.map((block) =>
        block.id === id ? { ...block, revisionColor: color } : block
      )
    );
    markUnsynced();
  }

  function toggleBlockLock(id: string) {
    setBlocks(
      blocks.map((block) =>
        block.id === id ? { ...block, locked: !block.locked } : block
      )
    );
    markUnsynced();
  }

  function insertBlock(type: ScriptBlock["type"], starterText = "") {
    const newBlock: ScriptBlock = {
      id: crypto.randomUUID(),
      type,
      text: starterText || (type === "scene" ? "INT. LOCATION - DAY" : ""),
      revisionColor: revisionMode ? currentRevisionColor : "none",
      locked: false,
      note: "",
    };

    const updated = [...blocks];
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : blocks.length;

    updated.splice(insertIndex, 0, newBlock);
    setBlocks(updated);
    focusBlockAfterRender(newBlock.id);
    setActiveBlockId(newBlock.id);
    markUnsynced();
    closeMenus();
  }

  function deleteActiveBlock() {
    if (activeIndex < 0 || blocks.length <= 1) return;
    if (activeBlock?.locked) {
      alert("This element is locked. Unlock it first.");
      return;
    }

    const updated = blocks.filter((_, index) => index !== activeIndex);
    const nextActiveId = updated[Math.max(0, activeIndex - 1)]?.id || null;
    setBlocks(updated);
    focusBlockAfterRender(nextActiveId);
    setActiveBlockId(nextActiveId);
    markUnsynced();
    closeMenus();
  }

  function duplicateActiveBlock() {
    if (!activeBlock || activeIndex < 0) return;

    const duplicate: ScriptBlock = {
      ...activeBlock,
      id: crypto.randomUUID(),
      locked: false,
    };

    const updated = [...blocks];
    updated.splice(activeIndex + 1, 0, duplicate);

    setBlocks(updated);
    focusBlockAfterRender(duplicate.id);
    setActiveBlockId(duplicate.id);
    markUnsynced();
    closeMenus();
  }

  function moveActiveBlock(direction: "up" | "down") {
    if (activeIndex < 0) return;
    if (activeBlock?.locked) {
      alert("This element is locked. Unlock it first.");
      return;
    }

    const targetIndex = direction === "up" ? activeIndex - 1 : activeIndex + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const updated = [...blocks];
    const [moved] = updated.splice(activeIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setBlocks(updated);
    markUnsynced();
    closeMenus();
  }

  function applyRevisionToActive(color: RevisionColor) {
    if (!activeBlock) return;
    updateBlockRevision(activeBlock.id, color);
    closeMenus();
  }

  function clearAllRevisions() {
    setBlocks(
      blocks.map((block) => ({
        ...block,
        revisionColor: "none",
      }))
    );
    markUnsynced();
    closeMenus();
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
      updated_at: Date.now(),
    });

    setScriptId(newId);
    setTitle("Untitled Script");
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

  function formatCleanup() {
    setBlocks(
      blocks.map((block) => {
        if (block.type === "scene" || block.type === "character") {
          return { ...block, text: block.text.toUpperCase() };
        }

        return block;
      })
    );

    markUnsynced();
    closeMenus();
  }

  function resetFormatDefaults() {
    setFormat(defaultFormat);
  }

  function showCollaborationPlaceholder() {
    alert("Collaboration coming soon.");
  }

  function showSplitPlaceholder() {
    alert("Split view coming soon.");
  }

  function showBeatBoardPlaceholder() {
    alert("Beat Board coming soon.");
  }

  function analyzeScript() {
    const notesOut: string[] = [];

    if (stats.scenes === 0) {
      notesOut.push("Add scene headings so the navigator can structure your script.");
    }

    if (stats.dialogue > stats.blocks * 0.6) {
      notesOut.push("Dialogue is heavy. Consider adding more action lines for pacing.");
    }

    if (stats.words < 100) {
      notesOut.push("This is still very short. Keep building the scene before judging pacing.");
    }

    if (stats.characters === 0) {
      notesOut.push("No character cues found yet. Add CHARACTER lines before dialogue.");
    }

    if (stats.locked > 0) {
      notesOut.push(`${stats.locked} element(s) are locked. Good for protecting production text.`);
    }

    if (stats.revisions > 0) {
      notesOut.push(`${stats.revisions} element(s) have revision colors applied.`);
    }

    if (notesOut.length === 0) {
      notesOut.push("Nice balance so far. Scene structure, dialogue, and action are all present.");
    }

    setFeedback(notesOut.join("\n\n"));
    setRightPanelMode("feedback");
    closeMenus();
  }

  function clearScript() {
    const confirmed = window.confirm(
      "Clear this script? This replaces the current script with FADE IN."
    );
    if (!confirmed) return;

    setBlocks([
      {
        id: crypto.randomUUID(),
        type: "action",
        text: "FADE IN:",
        revisionColor: "none",
        locked: false,
        note: "",
      },
    ]);

    markUnsynced();
    closeMenus();
  }

  function toggleWritingStatsPanel() {
    if (showRightPanel && rightPanelMode === "stats") {
      setShowRightPanel(false);
      return;
    }

    setShowRightPanel(true);
    setRightPanelMode("stats");
    closeMenus();
  }

  function toggleFeedbackPanel() {
    if (showRightPanel && rightPanelMode === "feedback") {
      setShowRightPanel(false);
      return;
    }

    setShowRightPanel(true);
    setRightPanelMode("feedback");
    closeMenus();
  }

  function toggleViewsMenu() {
    setActiveMenu((current) => (current === "view" ? null : "view"));
  }

  function toggleRightPanel() {
    setShowRightPanel((value) => !value);
    closeMenus();
  }

  function toggleNavigatorPanel() {
    setShowNavigator((value) => !value);
    closeMenus();
  }

  function scrollToBlock(id: string) {
    document.getElementById(`block-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const current = blocks[index];

    if (current.locked) {
      if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();

      const nextType = e.shiftKey
        ? getPreviousType(current.type)
        : getNextType(current.type);

      updateBlockType(current.id, nextType);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const nextType = getNextType(current.type);
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
      markUnsynced();
      return;
    }

    if (
      e.key === "Backspace" &&
      current.text.trim() === "" &&
      blocks.length > 1
    ) {
      e.preventDefault();
      const updated = blocks.filter((_, blockIndex) => blockIndex !== index);
      const nextActiveId = updated[Math.max(0, index - 1)]?.id || null;
      setBlocks(updated);
      focusBlockAfterRender(nextActiveId);
      setActiveBlockId(nextActiveId);
      markUnsynced();
    }
  }

  const gridColumns = `${showNavigator && !focusMode ? "260px" : "0px"} 1fr ${
    showRightPanel && !focusMode ? "300px" : "0px"
  }`;

  const contentWidth = format.pageWidth - format.leftMargin - format.rightMargin;

  return (
    <AppLayout showSaveStatus contentClassName="px-0 py-0 sm:px-0 sm:py-0">
      <div
        className="min-h-[calc(100vh-56px)] bg-zinc-200 text-zinc-950 font-sans"
        onClick={() => setActiveMenu(null)}
      >
      <header className="sticky top-14 z-30 border-b border-zinc-300 bg-zinc-50 font-sans shadow-sm">
        <div
          className="flex min-h-10 items-center gap-4 overflow-x-auto border-b border-zinc-200 px-3 text-xs font-sans sm:px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="shrink-0 font-bold tracking-wide">Script Studio</span>

          <MenuButton label="File" menu="file" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="Edit" menu="edit" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="View" menu="view" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="Insert" menu="insert" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="Tools" menu="tools" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="Production" menu="production" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <MenuButton label="Help" menu="help" activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

          {activeMenu === "file" && (
            <Dropdown left={64}>
              <DropdownItem label="New Script" helper="Create a blank script" onClick={createNewScript} />
              <DropdownItem label="Save Now" helper="Force cloud save" onClick={saveNow} />
              <DropdownItem label="Title Page" helper="Edit title page metadata" onClick={() => setShowTitlePage(true)} />
              <DropdownItem label="Back to Dashboard" helper="Return to script library" onClick={() => navigate("/dashboard")} />
              <Divider />
              <DropdownItem label="Export Settings" helper="All industry formats" onClick={() => setShowExportSettings(true)} />
              <DropdownItem label="Export FDX" helper="Final Draft editable handoff" onClick={exportFdx} />
              <DropdownItem label="Export Fountain" helper="Open screenplay format" onClick={exportFountain} />
              <DropdownItem label="Export PDF" helper="Submission/reading copy" onClick={exportPdf} />
              <DropdownItem label="Export RTF" helper="Word processor fallback" onClick={exportRtf} />
              <DropdownItem label="Export TXT" helper="Plain text fallback" onClick={exportPlainText} />
              <DropdownItem label="Print" helper="Open printable PDF" onClick={printScript} />
            </Dropdown>
          )}

          {activeMenu === "edit" && (
            <Dropdown left={112}>
              <DropdownItem label="Duplicate Element" helper="Copy current block below" onClick={duplicateActiveBlock} />
              <DropdownItem label="Delete Current Element" helper="Remove active block" onClick={deleteActiveBlock} />
              <DropdownItem label="Move Element Up" helper="Reorder current block" onClick={() => moveActiveBlock("up")} />
              <DropdownItem label="Move Element Down" helper="Reorder current block" onClick={() => moveActiveBlock("down")} />
              <Divider />
              <DropdownItem label="Lock / Unlock Element" helper="Protect current text from edits" onClick={() => activeBlock && toggleBlockLock(activeBlock.id)} />
              <DropdownItem label="Format Cleanup" helper="Uppercase scene/character cues" onClick={formatCleanup} />
              <DropdownItem label="Clear Script" helper="Reset current script" onClick={clearScript} />
            </Dropdown>
          )}

          {activeMenu === "view" && (
            <Dropdown left={160}>
              <DropdownItem label={showNavigator ? "Hide Navigator" : "Show Navigator"} helper="Toggle left scene panel" onClick={() => setShowNavigator(!showNavigator)} />
              <DropdownItem label={showRightPanel ? "Hide Tools Panel" : "Show Tools Panel"} helper="Toggle right stats/feedback panel" onClick={() => setShowRightPanel(!showRightPanel)} />
              <DropdownItem label={focusMode ? "Exit Focus Mode" : "Focus Mode"} helper="Hide side panels" onClick={() => setFocusMode(!focusMode)} />
              <Divider />
              <DropdownItem label="Zoom In" helper="Increase page scale" onClick={() => setPageScale((v) => Math.min(1.35, v + 0.05))} />
              <DropdownItem label="Zoom Out" helper="Decrease page scale" onClick={() => setPageScale((v) => Math.max(0.75, v - 0.05))} />
              <DropdownItem label="Reset Zoom" helper="100%" onClick={() => setPageScale(1)} />
              <Divider />
              <DropdownItem label="Writing Stats" helper="Show stats panel" onClick={() => setRightPanelMode("stats")} />
              <DropdownItem label="Feedback Panel" helper="Show feedback panel" onClick={() => setRightPanelMode("feedback")} />
              <DropdownItem label="Notes Panel" helper="Show element notes" onClick={() => setRightPanelMode("notes")} />
              <DropdownItem label="Suggestions Panel" helper="Show smart next steps" onClick={() => setRightPanelMode("suggestions")} />
            </Dropdown>
          )}

          {activeMenu === "insert" && (
            <Dropdown left={212}>
              <DropdownItem label="Scene Heading" helper="INT./EXT. slugline" onClick={() => insertBlock("scene")} />
              <DropdownItem label="Action" helper="Description text" onClick={() => insertBlock("action")} />
              <DropdownItem label="Character" helper="Speaker cue" onClick={() => insertBlock("character")} />
              <DropdownItem label="Dialogue" helper="Spoken line" onClick={() => insertBlock("dialogue")} />
              <Divider />
              <DropdownItem label="Transition" helper="Adds CUT TO:" onClick={() => insertBlock("action", "CUT TO:")} />
              <DropdownItem label="Shot" helper="Adds ANGLE ON:" onClick={() => insertBlock("action", "ANGLE ON:")} />
            </Dropdown>
          )}

          {activeMenu === "tools" && (
            <Dropdown left={270}>
              <DropdownItem label="Format Settings" helper="Margins, spacing, scene numbers" onClick={() => setShowFormatSettings(true)} />
              <DropdownItem label="Analyze Script" helper="Generate basic feedback" onClick={analyzeScript} />
              <DropdownItem label="Format Cleanup" helper="Fix common casing" onClick={formatCleanup} />
              <DropdownItem label="Smart Suggestions" helper="Open suggested next elements" onClick={() => setRightPanelMode("suggestions")} />
              <DropdownItem label="Show Writing Stats" helper="Open stats panel" onClick={() => setRightPanelMode("stats")} />
              <DropdownItem label="Reset Format Defaults" helper="Industry baseline" onClick={resetFormatDefaults} />
            </Dropdown>
          )}

          {activeMenu === "production" && (
            <Dropdown left={328}>
              <DropdownItem label={productionMode ? "Disable Production Mode" : "Enable Production Mode"} helper="Production label + future tools" onClick={() => setProductionMode(!productionMode)} />
              <DropdownItem label={revisionMode ? "Disable Revision Mode" : "Enable Revision Mode"} helper="Color new edits" onClick={() => setRevisionMode(!revisionMode)} />
              <DropdownItem label={format.showSceneNumbers ? "Hide Scene Numbers" : "Show Scene Numbers"} helper="Toggle left/right scene numbers" onClick={() => setFormat({ ...format, showSceneNumbers: !format.showSceneNumbers })} />
              <Divider />
              <DropdownItem label="Blue Revision" helper="Apply to active element" onClick={() => applyRevisionToActive("blue")} />
              <DropdownItem label="Pink Revision" helper="Apply to active element" onClick={() => applyRevisionToActive("pink")} />
              <DropdownItem label="Yellow Revision" helper="Apply to active element" onClick={() => applyRevisionToActive("yellow")} />
              <DropdownItem label="Clear All Revision Colors" helper="Remove color tags" onClick={clearAllRevisions} />
            </Dropdown>
          )}

          {activeMenu === "help" && (
            <Dropdown left={420}>
              <DropdownItem label="Keyboard Shortcuts" helper="Show controls" onClick={() => setShowShortcuts(true)} />
              <DropdownItem label="About Script Studio" helper="App info" onClick={() => setShowAbout(true)} />
            </Dropdown>
          )}
        </div>

        <ScriptToolbar
          title={title || "Untitled Script"}
          activeElementType={activeBlock?.type || "action"}
          onChangeElementType={(type) => {
            if (effectiveActiveBlockId) {
              updateBlockType(effectiveActiveBlockId, type);
            }
          }}
          onCollaboration={showCollaborationPlaceholder}
          onSplit={showSplitPlaceholder}
          onViews={toggleViewsMenu}
          onBeatBoard={showBeatBoardPlaceholder}
          onTitlePage={() => setShowTitlePage(true)}
          onWritingStats={toggleWritingStatsPanel}
          onShowHide={toggleRightPanel}
          onNavigator={toggleNavigatorPanel}
          onFeedback={toggleFeedbackPanel}
          isStatsActive={showRightPanel && rightPanelMode === "stats"}
          isShowHideActive={showRightPanel}
          isNavigatorActive={showNavigator}
          isFeedbackActive={showRightPanel && rightPanelMode === "feedback"}
        />
      </header>

      <div
        className="grid grid-cols-1 font-sans lg:[grid-template-columns:var(--editor-grid-cols)]"
        style={{ "--editor-grid-cols": gridColumns } as CSSProperties}
      >
        {showNavigator && !focusMode && (
          <aside
            className="hidden overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4 font-sans shadow-inner lg:sticky lg:top-[148px] lg:block lg:h-[calc(100vh-148px)]"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Navigator</h2>
            <p className="mt-1 text-xs text-zinc-500">Scenes, notes & locks</p>

            <div className="mt-4 space-y-2">
              {scenes.length === 0 && <p className="text-xs text-zinc-400">No scene headings yet.</p>}

              {scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  onClick={() => scrollToBlock(scene.id)}
                  className="w-full rounded border border-zinc-200 bg-white p-2 text-left text-xs shadow-sm transition hover:border-zinc-300 hover:shadow"
                >
                  <span className="block font-bold text-zinc-700">
                    Scene {index + 1} {scene.locked ? "🔒" : ""}
                  </span>
                  <span className="block text-zinc-500">{scene.text || "Untitled Scene"}</span>
                  {scene.note && <span className="mt-1 block text-[10px] text-blue-500">Has note</span>}
                </button>
              ))}
            </div>
          </aside>
        )}

        <main className="min-h-[calc(100vh-148px)] overflow-x-auto overflow-y-auto px-3 py-4 font-sans sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto mb-4 flex min-w-max items-center justify-between gap-3" style={{ width: `${format.pageWidth * pageScale}in` }}>
            <input
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              className="min-w-0 w-full bg-transparent text-lg font-bold outline-none"
              placeholder="Untitled Script"
            />

            <span className="shrink-0 text-xs text-zinc-500">
              {format.pageWidth}" × {format.pageHeight}"
            </span>
          </div>

          <div
            style={{
              transform: `scale(${pageScale})`,
              transformOrigin: "top center",
            }}
          >
            <div
              className="mx-auto rounded-sm bg-white text-black shadow-xl"
              style={{
                width: `${format.pageWidth}in`,
                minHeight: `${format.pageHeight}in`,
                paddingTop: `${format.topMargin}in`,
                paddingBottom: `${format.bottomMargin}in`,
                paddingLeft: `${format.leftMargin}in`,
                paddingRight: `${format.rightMargin}in`,
                fontFamily: '"Courier Prime", Courier, monospace',
                fontSize: `${format.fontSize}pt`,
                lineHeight: format.lineHeight,
              }}
            >
              <div style={{ width: `${contentWidth}in` }}>
                {blocks.map((block, index) => {
                  const sceneIndex = scenes.findIndex((scene) => scene.id === block.id);
                  const isActiveBlock = block.id === effectiveActiveBlockId;
                  const showRevisionBackground =
                    revisionMode &&
                    block.revisionColor !== undefined &&
                    block.revisionColor !== "none";

                  return (
                    <div
                      id={`block-${block.id}`}
                      key={block.id}
                      className={`group relative rounded-sm ${
                        isActiveBlock ? "bg-blue-50/20" : ""
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
                          className="absolute bottom-1 top-1 w-1 rounded-full bg-blue-500/70"
                          style={{ left: "-0.28in" }}
                        />
                      )}

                      {block.type === "scene" && format.showSceneNumbers && sceneIndex >= 0 && (
                        <>
                          <span className="absolute top-0 text-xs text-zinc-500" style={{ left: "-0.55in" }}>
                            {sceneIndex + 1}.
                          </span>
                          <span className="absolute top-0 text-xs text-zinc-500" style={{ right: "-0.55in" }}>
                            {sceneIndex + 1}.
                          </span>
                        </>
                      )}

                      <span className="absolute top-1 hidden rounded bg-zinc-100 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 group-hover:block" style={{ left: "-0.95in" }}>
                        {block.type}
                      </span>

                      {block.note && (
                        <span className="absolute top-7 hidden rounded bg-blue-100 px-2 py-1 text-[10px] text-blue-700 group-hover:block" style={{ left: "-0.95in" }}>
                          note
                        </span>
                      )}

                      {block.locked && (
                        <span className="absolute top-13 hidden rounded bg-red-100 px-2 py-1 text-[10px] text-red-700 group-hover:block" style={{ left: "-0.95in" }}>
                          locked
                        </span>
                      )}

                      <textarea
                        value={block.text}
                        disabled={block.locked}
                        ref={(textarea) => registerTextarea(block.id, textarea)}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChange={(e) => {
                          resizeTextarea(e.currentTarget);
                          updateBlock(block.id, e.target.value);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        rows={1}
                        className="resize-none overflow-hidden rounded-sm bg-transparent outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-80"
                        style={{
                          width: block.type === "dialogue" ? `${format.dialogueWidth}in` : "100%",
                          marginLeft:
                            block.type === "character"
                              ? `${format.characterIndent - format.leftMargin}in`
                              : block.type === "dialogue"
                              ? `${format.dialogueIndent - format.leftMargin}in`
                              : "0in",
                          marginTop:
                            block.type === "scene"
                              ? "0.25in"
                              : block.type === "character"
                              ? "0.22in"
                              : "0in",
                          marginBottom: block.type === "dialogue" ? "0.12in" : "0in",
                          fontWeight:
                            block.type === "scene" || block.type === "character" ? 700 : 400,
                          textTransform:
                            block.type === "scene" || block.type === "character" ? "uppercase" : "none",
                          fontFamily: '"Courier Prime", Courier, monospace',
                          fontSize: `${format.fontSize}pt`,
                          lineHeight: format.lineHeight,
                          background: showRevisionBackground
                            ? revisionBackground(block.revisionColor)
                            : elementBackground(block.type, isActiveBlock),
                        }}
                        placeholder={block.type === "scene" ? "SCENE HEADING" : block.type.toUpperCase()}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {showRightPanel && !focusMode && (
          <aside
            className="hidden overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4 font-sans shadow-inner lg:sticky lg:top-[148px] lg:block lg:h-[calc(100vh-148px)]"
          >
            <div className="mb-4 grid grid-cols-2 gap-2 rounded border border-zinc-200 bg-white p-1 shadow-sm">
              <PanelButton label="Stats" active={rightPanelMode === "stats"} onClick={() => setRightPanelMode("stats")} />
              <PanelButton label="Feedback" active={rightPanelMode === "feedback"} onClick={() => setRightPanelMode("feedback")} />
              <PanelButton label="Notes" active={rightPanelMode === "notes"} onClick={() => setRightPanelMode("notes")} />
              <PanelButton label="Suggest" active={rightPanelMode === "suggestions"} onClick={() => setRightPanelMode("suggestions")} />
            </div>

            {rightPanelMode === "stats" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Writing Stats</h2>
                <Stat label="Scenes" value={stats.scenes} />
                <Stat label="Elements" value={stats.blocks} />
                <Stat label="Words" value={stats.words} />
                <Stat label="Estimated Pages" value={stats.estimatedPages} />
                <Stat label="Notes" value={stats.notes} />
                <Stat label="Locked" value={stats.locked} />
                <Stat label="Revisions" value={stats.revisions} />
              </div>
            )}

            {rightPanelMode === "feedback" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Feedback</h2>

                <div className="whitespace-pre-wrap rounded border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm">
                  {feedback}
                </div>

                <button onClick={analyzeScript} className="w-full rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">
                  Analyze Script
                </button>
              </div>
            )}

            {rightPanelMode === "notes" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Element Notes</h2>

                {activeBlock ? (
                  <>
                    <p className="text-xs text-zinc-500">Current: {activeBlock.type}</p>

                    <textarea
                      value={activeBlock.note || ""}
                      onChange={(e) => updateBlockNote(activeBlock.id, e.target.value)}
                      placeholder="Add a note for this element..."
                      className="h-32 w-full resize-none rounded border border-zinc-200 bg-white p-3 text-sm shadow-sm outline-none focus:border-blue-400"
                    />

                    <button onClick={() => toggleBlockLock(activeBlock.id)} className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:bg-zinc-50">
                      {activeBlock.locked ? "Unlock Element" : "Lock Element"}
                    </button>

                    <select
                      value={activeBlock.revisionColor || "none"}
                      onChange={(e) => updateBlockRevision(activeBlock.id, e.target.value as RevisionColor)}
                      className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm"
                    >
                      {revisionColors.map((color) => (
                        <option key={color} value={color}>
                          {color === "none" ? "No Revision Color" : `${color} revision`}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">Click an element to add notes.</p>
                )}

                <div className="space-y-2 pt-3">
                  {notes.map((noteBlock) => (
                    <button
                      key={noteBlock.id}
                      onClick={() => scrollToBlock(noteBlock.id)}
                      className="w-full rounded border border-zinc-200 bg-white p-2 text-left text-xs shadow-sm hover:bg-zinc-50"
                    >
                      <span className="block font-bold uppercase">{noteBlock.type}</span>
                      <span className="line-clamp-2 text-zinc-500">{noteBlock.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rightPanelMode === "suggestions" && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Smart Suggestions</h2>
                <p className="text-xs text-zinc-500">
                  Based on your current element, here are useful next moves.
                </p>

                {smartSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.label}-${suggestion.type}`}
                    onClick={() => insertBlock(suggestion.type, suggestion.text || "")}
                    className="w-full rounded border border-zinc-200 bg-white p-3 text-left text-xs shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <span className="block font-bold">{suggestion.label}</span>
                    <span className="block text-zinc-500">{suggestion.helper}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {showTitlePage && (
        <LargeModal title="Title Page" onClose={() => setShowTitlePage(false)}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
            <div>
              <TextField label="Title" value={resolvedTitlePage.title} onChange={updateTitle} />
              <TextField label="Written By" value={titlePage.writtenBy} onChange={(value) => setTitlePage({ ...titlePage, writtenBy: value })} />
              <TextField label="Based On" value={titlePage.basedOn} onChange={(value) => setTitlePage({ ...titlePage, basedOn: value })} />
              <TextAreaField label="Contact Info" value={titlePage.contact} onChange={(value) => setTitlePage({ ...titlePage, contact: value })} />
              <TextField label="Draft Date" value={titlePage.draftDate} onChange={(value) => setTitlePage({ ...titlePage, draftDate: value })} />

              <button onClick={() => setShowTitlePage(false)} className="mt-4 rounded bg-zinc-900 px-4 py-2 text-sm font-bold text-white">
                Save Title Page
              </button>
            </div>

            <div className="h-[340px] rounded border border-zinc-300 bg-white p-6 text-center shadow-inner sm:h-[430px] sm:p-8" style={{ fontFamily: '"Courier Prime", Courier, monospace' }}>
              <div className="mt-20 text-lg font-bold uppercase">
                {resolvedTitlePage.title}
              </div>
              <div className="mt-10 text-sm">Written by</div>
              <div className="mt-2 text-sm">{titlePage.writtenBy || "Your Name"}</div>
              {titlePage.basedOn && <div className="mt-10 text-xs">Based on {titlePage.basedOn}</div>}
              <div className="mt-24 whitespace-pre-wrap text-left text-xs">{titlePage.contact || "Contact information"}</div>
              <div className="mt-6 text-left text-xs">{titlePage.draftDate}</div>
            </div>
          </div>
        </LargeModal>
      )}

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

function MenuButton({
  label,
  menu,
  activeMenu,
  setActiveMenu,
}: {
  label: string;
  menu: Exclude<MenuName, null>;
  activeMenu: MenuName;
  setActiveMenu: (menu: MenuName) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === menu ? null : menu);
      }}
      className={`rounded px-2 py-1 font-sans transition ${
        activeMenu === menu
          ? "bg-white text-zinc-950 shadow-sm"
          : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950"
      }`}
    >
      {label}
    </button>
  );
}

function Dropdown({ left, children }: { left: number; children: ReactNode }) {
  return (
    <div
      className="absolute top-8 z-50 w-[min(16rem,calc(100vw-1rem))] rounded border border-zinc-200 bg-white py-1 font-sans text-xs text-zinc-900 shadow-xl"
      style={{ left: `clamp(0.5rem, ${left}px, calc(100vw - 16.5rem))` }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  label,
  helper,
  onClick,
}: {
  label: string;
  helper?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-2 text-left font-sans hover:bg-zinc-50">
      <span className="block font-medium">{label}</span>
      {helper && <span className="block text-[10px] text-zinc-500">{helper}</span>}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-zinc-200" />;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-3 font-sans shadow-sm">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function PanelButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
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

function TextAreaField({
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
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-24 w-full resize-none rounded border border-zinc-300 px-3 py-2 text-sm font-normal" />
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

function LargeModal({
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
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded bg-white p-4 text-zinc-900 shadow-2xl sm:p-5">
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
