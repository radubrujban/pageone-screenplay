import type { RevisionColor, ScriptBlock } from "../types/script";

export type TitlePageData = {
  title: string;
  writtenBy: string;
  basedOn: string;
  contact: string;
  draftDate: string;
};

export type FormatSettings = {
  pageWidth: number;
  pageHeight: number;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  fontSize: number;
  lineHeight: number;
  characterIndent: number;
  dialogueIndent: number;
  dialogueWidth: number;
  showSceneNumbers: boolean;
};

export type ExportSettings = {
  includeTitlePage: boolean;
  includeSceneNumbers: boolean;
  includeMetadata: boolean;
  fileName: string;
};

type ExportBuildInput = {
  blocks: ScriptBlock[];
  title: string;
  titlePage: TitlePageData;
  exportSettings: ExportSettings;
};

type PdfBuildInput = ExportBuildInput & {
  format: FormatSettings;
  pageBlockIndices?: number[][];
};

export const defaultFormat: FormatSettings = {
  pageWidth: 8.5,
  pageHeight: 11,
  topMargin: 1,
  bottomMargin: 1,
  leftMargin: 1.5,
  rightMargin: 1,
  fontSize: 12,
  lineHeight: 1.25,
  characterIndent: 3.5,
  dialogueIndent: 2.5,
  dialogueWidth: 3.5,
  showSceneNumbers: true,
};

export const blockTypes: ScriptBlock["type"][] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
  "shot",
  "general",
];

export const revisionColors: RevisionColor[] = [
  "none",
  "blue",
  "pink",
  "yellow",
  "green",
  "orange",
];

function isSceneHeadingType(type: ScriptBlock["type"]) {
  return type === "scene_heading" || type === "scene";
}

function normalizeBlockType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  return type === "scene" ? "scene_heading" : type;
}

function isDialogueFlowType(type: ScriptBlock["type"]) {
  const normalizedType = normalizeBlockType(type);
  return (
    normalizedType === "character" ||
    normalizedType === "parenthetical" ||
    normalizedType === "dialogue"
  );
}

export const sceneHeadingSuggestions = [
  "INT.",
  "EXT.",
  "INT./EXT.",
  "EXT./INT.",
] as const;

export const transitionSuggestions = [
  "CUT TO:",
  "FADE IN:",
  "FADE OUT.",
  "DISSOLVE TO:",
  "MATCH CUT TO:",
  "SMASH CUT TO:",
] as const;

export const shotSuggestions = [
  "CLOSE ON:",
  "ANGLE ON:",
  "POV:",
  "INSERT:",
  "WIDE SHOT:",
  "TRACKING SHOT:",
] as const;

export function detectType(text: string, currentType: ScriptBlock["type"]) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.)/.test(upper)) {
    return "scene_heading";
  }
  if (
    transitionSuggestions.some((suggestion) =>
      upper.startsWith(suggestion.replace(/[.:]/g, ""))
    )
  ) {
    return "transition";
  }
  if (shotSuggestions.some((suggestion) => upper.startsWith(suggestion.replace(":", "")))) {
    return "shot";
  }
  if (/^[A-Z0-9 .'-]+ TO:$/.test(upper)) return "transition";
  if (/^[A-Z0-9 .'-]+:$/.test(upper) && upper.length > 0) return "shot";
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return "parenthetical";
  if (currentType !== "action" && currentType !== "general") return currentType;
  if (/^[A-Z\s]{2,30}$/.test(trimmed) && trimmed.length > 0) return "character";

  return "action";
}

export function getNextType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  const normalizedType = normalizeBlockType(type);
  const index = blockTypes.indexOf(normalizedType);
  return blockTypes[(index + 1) % blockTypes.length];
}

export function getPreviousType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  const normalizedType = normalizeBlockType(type);
  const index = blockTypes.indexOf(normalizedType);
  return blockTypes[(index - 1 + blockTypes.length) % blockTypes.length];
}

export function predictNextType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  const normalizedType = normalizeBlockType(type);

  if (normalizedType === "scene_heading") return "action";
  if (normalizedType === "action") return "action";
  if (normalizedType === "character") return "dialogue";
  if (normalizedType === "parenthetical") return "dialogue";
  if (normalizedType === "dialogue") return "action";
  if (normalizedType === "transition") return "scene_heading";
  if (normalizedType === "shot") return "action";
  if (normalizedType === "general") return "action";
  return "action";
}

export function blockToText(block: ScriptBlock) {
  if (isSceneHeadingType(block.type)) return block.text.toUpperCase();
  if (block.type === "character") return `\n${block.text.toUpperCase()}`;
  if (block.type === "transition") return `> ${block.text.toUpperCase()}`;
  if (block.type === "shot") return block.text.toUpperCase();
  if (block.type === "parenthetical") return `      ${block.text}`;
  if (block.type === "dialogue") return `    ${block.text}`;
  if (block.type === "general") return block.text;
  return block.text;
}

export function revisionBackground(color?: RevisionColor) {
  if (color === "blue") return "#dbeafe";
  if (color === "pink") return "#fce7f3";
  if (color === "yellow") return "#fef9c3";
  if (color === "green") return "#dcfce7";
  if (color === "orange") return "#ffedd5";
  return "transparent";
}

export function buildFountain({
  blocks,
  title,
  titlePage,
  exportSettings,
}: ExportBuildInput) {
  const metadataLines = exportSettings.includeMetadata
    ? [
        `Title: ${titlePage.title || title}`,
        titlePage.writtenBy ? `Author: ${titlePage.writtenBy}` : "",
        titlePage.basedOn ? `Source: ${titlePage.basedOn}` : "",
        titlePage.draftDate ? `Draft date: ${titlePage.draftDate}` : "",
      ].filter(Boolean)
    : [];

  const bodyLines: string[] = [];

  blocks.forEach((block, blockIndex) => {
    const normalizedType = normalizeBlockType(block.type);
    const previousType =
      blockIndex > 0 ? normalizeBlockType(blocks[blockIndex - 1].type) : null;
    const currentText = block.text.replace(/\r\n/g, "\n").trimEnd();

    const formattedText =
      normalizedType === "scene_heading" ||
      normalizedType === "character" ||
      normalizedType === "transition" ||
      normalizedType === "shot"
        ? currentText.toUpperCase()
        : normalizedType === "parenthetical"
          ? (() => {
              const trimmed = currentText.trim();
              if (!trimmed) return "";
              if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
              return `(${trimmed.replace(/^\(+|\)+$/g, "")})`;
            })()
          : currentText;

    const continuesDialogueFlow =
      previousType !== null &&
      isDialogueFlowType(normalizedType) &&
      isDialogueFlowType(previousType);

    if (
      bodyLines.length > 0 &&
      !continuesDialogueFlow &&
      bodyLines[bodyLines.length - 1] !== ""
    ) {
      bodyLines.push("");
    }

    if (!formattedText.trim()) return;

    bodyLines.push(...formattedText.split("\n"));
  });

  const body = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const metadata = metadataLines.length ? `${metadataLines.join("\n")}\n\n` : "";
  const output = `${metadata}${body}`.trimEnd();
  return output ? `${output}\n` : "";
}

export function buildPlainText({
  blocks,
  title,
  titlePage,
  exportSettings,
}: ExportBuildInput) {
  const titleText = exportSettings.includeTitlePage
    ? [
        (titlePage.title || title || "Untitled Script").toUpperCase(),
        "",
        titlePage.writtenBy ? `Written by ${titlePage.writtenBy}` : "",
        titlePage.basedOn ? `Based on ${titlePage.basedOn}` : "",
        "",
        titlePage.contact,
        titlePage.draftDate,
        "",
        "----------------------------------------",
        "",
      ].join("\n")
    : "";

  return `${titleText}${blocks.map(blockToText).join("\n\n")}`;
}

export function buildRtf({
  blocks,
  title,
  titlePage,
  exportSettings,
}: ExportBuildInput) {
  const titleText = exportSettings.includeTitlePage
    ? [
        `\\qc\\b ${escapeRtf(
          titlePage.title || title || "Untitled Script"
        )}\\b0\\par\\par`,
        titlePage.writtenBy
          ? `\\qc Written by\\par ${escapeRtf(titlePage.writtenBy)}\\par\\par`
          : "",
        titlePage.basedOn
          ? `\\qc Based on ${escapeRtf(titlePage.basedOn)}\\par\\par`
          : "",
        titlePage.contact ? `\\ql ${escapeRtf(titlePage.contact)}\\par` : "",
        titlePage.draftDate ? `\\ql ${escapeRtf(titlePage.draftDate)}\\par\\page` : "\\page",
      ].join("")
    : "";

  const body = blocks
    .map((block) => {
      if (isSceneHeadingType(block.type))
        return `\\ql\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      if (block.type === "character")
        return `\\li3600\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      if (block.type === "parenthetical")
        return `\\li2520\\ri2520 ${escapeRtf(block.text)}\\par`;
      if (block.type === "dialogue")
        return `\\li1800\\ri1800 ${escapeRtf(block.text)}\\par`;
      if (block.type === "transition")
        return `\\qr\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      if (block.type === "shot")
        return `\\ql\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      return `\\ql ${escapeRtf(block.text)}\\par`;
    })
    .join("\\par");

  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Courier New;}}\\f0\\fs24 ${titleText}${body}}`;
}

export function buildFdx({
  blocks,
  title,
  titlePage,
  exportSettings,
}: ExportBuildInput) {
  const titlePageXml = exportSettings.includeTitlePage
    ? `
  <TitlePage>
    <Content>
      <Paragraph Type="Title"><Text>${escapeXml(
        titlePage.title || title || "Untitled Script"
      )}</Text></Paragraph>
      <Paragraph Type="Action"><Text>Written by</Text></Paragraph>
      <Paragraph Type="Action"><Text>${escapeXml(
        titlePage.writtenBy || ""
      )}</Text></Paragraph>
      <Paragraph Type="Action"><Text>${escapeXml(
        titlePage.basedOn ? `Based on ${titlePage.basedOn}` : ""
      )}</Text></Paragraph>
      <Paragraph Type="Action"><Text>${escapeXml(
        titlePage.contact || ""
      )}</Text></Paragraph>
      <Paragraph Type="Action"><Text>${escapeXml(
        titlePage.draftDate || ""
      )}</Text></Paragraph>
    </Content>
  </TitlePage>`
    : "";

  const contentXml = blocks
    .map((block) => {
      const type =
        isSceneHeadingType(block.type)
          ? "Scene Heading"
          : block.type === "action"
            ? "Action"
            : block.type === "character"
              ? "Character"
              : block.type === "parenthetical"
                ? "Parenthetical"
                : block.type === "transition"
                  ? "Transition"
                  : block.type === "shot"
                    ? "Shot"
                    : block.type === "general"
                      ? "Action"
                    : "Dialogue";

      return `    <Paragraph Type="${type}"><Text>${escapeXml(
        block.text
      )}</Text></Paragraph>`;
    })
    .join("\n");

  const metadataXml = exportSettings.includeMetadata
    ? `
  <DocumentSettings>
    <Setting Name="Title" Value="${escapeXml(
      titlePage.title || title || "Untitled Script"
    )}" />
    <Setting Name="Author" Value="${escapeXml(titlePage.writtenBy || "")}" />
    <Setting Name="DraftDate" Value="${escapeXml(titlePage.draftDate || "")}" />
  </DocumentSettings>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
${metadataXml}
${titlePageXml}
  <Content>
${contentXml}
  </Content>
</FinalDraft>`;
}

const POINTS_PER_INCH = 72;

type FontMetrics = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

type PdfBlockLayout = {
  x: number;
  maxWidth: number;
  align: "left" | "right";
  uppercase: boolean;
  bold: boolean;
  italic: boolean;
  beforeGap: number;
  afterGap: number;
};

function getBlockVerticalSpacingInches(type: ScriptBlock["type"]) {
  const normalizedType = normalizeBlockType(type);

  const top =
    normalizedType === "scene_heading"
      ? 0.28
      : normalizedType === "transition"
        ? 0.24
        : normalizedType === "shot"
          ? 0.16
          : normalizedType === "character"
            ? 0.2
            : normalizedType === "parenthetical"
              ? 0.02
              : normalizedType === "dialogue"
                ? 0.01
                : normalizedType === "action" || normalizedType === "general"
                  ? 0.03
                  : 0;

  const bottom =
    normalizedType === "scene_heading"
      ? 0.1
      : normalizedType === "transition"
        ? 0.1
        : normalizedType === "shot"
          ? 0.08
          : normalizedType === "character"
            ? 0.02
            : normalizedType === "parenthetical"
              ? 0.03
              : normalizedType === "dialogue"
                ? 0.11
                : normalizedType === "action" || normalizedType === "general"
                  ? 0.05
                  : 0;

  return {
    top: top * POINTS_PER_INCH,
    bottom: bottom * POINTS_PER_INCH,
  };
}

function normalizeBlockTextForPdf(block: ScriptBlock) {
  const normalizedType = normalizeBlockType(block.type);
  const text = block.text.replace(/\r\n/g, "\n");

  if (
    normalizedType === "scene_heading" ||
    normalizedType === "character" ||
    normalizedType === "transition" ||
    normalizedType === "shot"
  ) {
    return text.toUpperCase();
  }

  return text;
}

function getPdfBlockLayout(
  block: ScriptBlock,
  format: FormatSettings,
  left: number,
  contentMaxWidth: number
): PdfBlockLayout {
  const normalizedType = normalizeBlockType(block.type);
  const contentWidthInches = contentMaxWidth / POINTS_PER_INCH;

  const characterOffsetInches = Math.max(0, format.characterIndent - format.leftMargin);
  const dialogueOffsetInches = Math.max(0, format.dialogueIndent - format.leftMargin);
  const parentheticalOffsetInches = Math.max(0, 3 - format.leftMargin);

  const characterWidth = Math.max(
    POINTS_PER_INCH,
    Math.min(
      contentMaxWidth - characterOffsetInches * POINTS_PER_INCH,
      2.5 * POINTS_PER_INCH
    )
  );
  const dialogueWidth = Math.max(
    POINTS_PER_INCH,
    Math.min(
      contentMaxWidth - dialogueOffsetInches * POINTS_PER_INCH,
      format.dialogueWidth * POINTS_PER_INCH
    )
  );
  const parentheticalWidth = Math.max(
    POINTS_PER_INCH,
    Math.min(
      contentMaxWidth - parentheticalOffsetInches * POINTS_PER_INCH,
      2.5 * POINTS_PER_INCH
    )
  );

  const spacing = getBlockVerticalSpacingInches(normalizedType);

  if (normalizedType === "character") {
    return {
      x: left + characterOffsetInches * POINTS_PER_INCH,
      maxWidth: characterWidth,
      align: "left",
      uppercase: true,
      bold: true,
      italic: false,
      beforeGap: spacing.top,
      afterGap: spacing.bottom,
    };
  }

  if (normalizedType === "dialogue") {
    return {
      x: left + dialogueOffsetInches * POINTS_PER_INCH,
      maxWidth: dialogueWidth,
      align: "left",
      uppercase: false,
      bold: false,
      italic: false,
      beforeGap: spacing.top,
      afterGap: spacing.bottom,
    };
  }

  if (normalizedType === "parenthetical") {
    return {
      x: left + parentheticalOffsetInches * POINTS_PER_INCH,
      maxWidth: parentheticalWidth,
      align: "left",
      uppercase: false,
      bold: false,
      italic: true,
      beforeGap: spacing.top,
      afterGap: spacing.bottom,
    };
  }

  if (normalizedType === "transition") {
    return {
      x: left,
      maxWidth: Math.max(contentWidthInches * POINTS_PER_INCH, POINTS_PER_INCH),
      align: "right",
      uppercase: true,
      bold: true,
      italic: false,
      beforeGap: spacing.top,
      afterGap: spacing.bottom,
    };
  }

  return {
    x: left,
    maxWidth: Math.max(contentMaxWidth, POINTS_PER_INCH),
    align: "left",
    uppercase: normalizedType === "scene_heading" || normalizedType === "shot",
    bold: normalizedType === "scene_heading" || normalizedType === "shot",
    italic: false,
    beforeGap: spacing.top,
    afterGap: spacing.bottom,
  };
}

function breakWordToWidth(
  word: string,
  maxWidth: number,
  font: FontMetrics,
  fontSize: number
) {
  if (!word) return [""];
  if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) return [word];

  const pieces: string[] = [];
  let currentPiece = "";

  for (const char of word) {
    const nextPiece = `${currentPiece}${char}`;
    if (
      currentPiece &&
      font.widthOfTextAtSize(nextPiece, fontSize) > maxWidth
    ) {
      pieces.push(currentPiece);
      currentPiece = char;
      continue;
    }
    currentPiece = nextPiece;
  }

  if (currentPiece) pieces.push(currentPiece);
  return pieces;
}

function wrapTextToWidth(
  text: string,
  maxWidth: number,
  font: FontMetrics,
  fontSize: number
) {
  const safeText = text.replace(/\r\n/g, "\n");
  const sourceLines = safeText.split("\n");
  const wrapped: string[] = [];

  sourceLines.forEach((sourceLine) => {
    if (!sourceLine.trim()) {
      wrapped.push("");
      return;
    }

    const words = sourceLine.split(/\s+/).filter(Boolean);
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        return;
      }

      if (currentLine) {
        wrapped.push(currentLine);
        currentLine = "";
      }

      const pieces = breakWordToWidth(word, maxWidth, font, fontSize);
      if (pieces.length === 0) return;

      if (pieces.length === 1) {
        currentLine = pieces[0];
        return;
      }

      wrapped.push(...pieces.slice(0, -1));
      currentLine = pieces[pieces.length - 1] ?? "";
    });

    wrapped.push(currentLine || "");
  });

  return wrapped.length > 0 ? wrapped : [""];
}

export async function buildPdfBlob({
  blocks,
  title,
  titlePage,
  exportSettings,
  format,
  pageBlockIndices,
}: PdfBuildInput) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const courierOblique = await pdfDoc.embedFont(StandardFonts.CourierOblique);
  const courierBoldOblique = await pdfDoc.embedFont(
    StandardFonts.CourierBoldOblique
  );

  const safeFormat: FormatSettings = {
    pageWidth: Number.isFinite(format.pageWidth) && format.pageWidth > 0 ? format.pageWidth : 8.5,
    pageHeight:
      Number.isFinite(format.pageHeight) && format.pageHeight > 0 ? format.pageHeight : 11,
    topMargin: Number.isFinite(format.topMargin) && format.topMargin >= 0 ? format.topMargin : 1,
    bottomMargin:
      Number.isFinite(format.bottomMargin) && format.bottomMargin >= 0
        ? format.bottomMargin
        : 1,
    leftMargin: Number.isFinite(format.leftMargin) && format.leftMargin >= 0 ? format.leftMargin : 1.5,
    rightMargin:
      Number.isFinite(format.rightMargin) && format.rightMargin >= 0 ? format.rightMargin : 1,
    fontSize: Number.isFinite(format.fontSize) && format.fontSize > 0 ? format.fontSize : 12,
    lineHeight:
      Number.isFinite(format.lineHeight) && format.lineHeight > 0 ? format.lineHeight : 1.25,
    characterIndent:
      Number.isFinite(format.characterIndent) && format.characterIndent >= 0
        ? format.characterIndent
        : 3.5,
    dialogueIndent:
      Number.isFinite(format.dialogueIndent) && format.dialogueIndent >= 0
        ? format.dialogueIndent
        : 2.5,
    dialogueWidth:
      Number.isFinite(format.dialogueWidth) && format.dialogueWidth > 0
        ? format.dialogueWidth
        : 3.5,
    showSceneNumbers: format.showSceneNumbers,
  };

  const pageWidth = safeFormat.pageWidth * POINTS_PER_INCH;
  const pageHeight = safeFormat.pageHeight * POINTS_PER_INCH;
  const left = safeFormat.leftMargin * POINTS_PER_INCH;
  const right = safeFormat.rightMargin * POINTS_PER_INCH;
  const top = pageHeight - safeFormat.topMargin * POINTS_PER_INCH;
  const bottom = safeFormat.bottomMargin * POINTS_PER_INCH;
  const fontSize = Math.max(12, safeFormat.fontSize);
  const lineGap = fontSize * Math.max(1.2, safeFormat.lineHeight);
  const contentMaxWidth = Math.max(POINTS_PER_INCH, pageWidth - left - right);
  const pageContentHeight = Math.max(lineGap, top - bottom);

  const fontForLayout = (layout: PdfBlockLayout) => {
    if (layout.bold && layout.italic) return courierBoldOblique;
    if (layout.bold) return courierBold;
    if (layout.italic) return courierOblique;
    return courier;
  };

  const prepareBlockForPdf = (block: ScriptBlock) => {
    const layout = getPdfBlockLayout(block, safeFormat, left, contentMaxWidth);
    const text = normalizeBlockTextForPdf(block);
    const wrappingFont = fontForLayout(layout);
    const lines = wrapTextToWidth(
      text || "",
      Math.max(POINTS_PER_INCH, layout.maxWidth),
      wrappingFont,
      fontSize
    );
    const height = layout.beforeGap + lines.length * lineGap + layout.afterGap;

    return { layout, lines, height };
  };

  const addContentPage = () => pdfDoc.addPage([pageWidth, pageHeight]);

  if (exportSettings.includeTitlePage) {
    const titlePagePdf = pdfDoc.addPage([pageWidth, pageHeight]);
    const titleText = titlePage.title || title || "Untitled Script";
    const centerX =
      pageWidth / 2 -
      courierBold.widthOfTextAtSize(titleText.toUpperCase(), fontSize) / 2;

    titlePagePdf.drawText(titleText.toUpperCase(), {
      x: centerX,
      y: pageHeight - 220,
      size: fontSize,
      font: courierBold,
    });

    titlePagePdf.drawText("Written by", {
      x: pageWidth / 2 - courier.widthOfTextAtSize("Written by", fontSize) / 2,
      y: pageHeight - 300,
      size: fontSize,
      font: courier,
    });

    titlePagePdf.drawText(titlePage.writtenBy || "Your Name", {
      x:
        pageWidth / 2 -
        courier.widthOfTextAtSize(titlePage.writtenBy || "Your Name", fontSize) /
          2,
      y: pageHeight - 330,
      size: fontSize,
      font: courier,
    });

    if (titlePage.basedOn) {
      titlePagePdf.drawText(`Based on ${titlePage.basedOn}`, {
        x: pageWidth / 2 - 140,
        y: pageHeight - 390,
        size: fontSize,
        font: courier,
      });
    }

    titlePagePdf.drawText(titlePage.contact || "Contact information", {
      x: left,
      y: 120,
      size: fontSize,
      font: courier,
    });

    titlePagePdf.drawText(titlePage.draftDate || "", {
      x: left,
      y: 95,
      size: fontSize,
      font: courier,
    });
  }

  const suppliedGroups = (pageBlockIndices ?? [])
    .map((indices) =>
      indices.filter((index) => index >= 0 && index < blocks.length)
    )
    .filter((indices) => indices.length > 0);

  const fallbackGroups = () => {
    const groups: number[][] = [];
    let current: number[] = [];
    let currentHeight = 0;

    blocks.forEach((block, index) => {
      const prepared = prepareBlockForPdf(block);
      const blockHeight = Number.isFinite(prepared.height)
        ? prepared.height
        : lineGap;

      if (
        current.length > 0 &&
        currentHeight + blockHeight > pageContentHeight
      ) {
        groups.push(current);
        current = [index];
        currentHeight = blockHeight;
        return;
      }

      current.push(index);
      currentHeight += blockHeight;
    });

    if (current.length > 0) groups.push(current);
    return groups.length > 0 ? groups : [[]];
  };

  const pageGroups =
    suppliedGroups.length > 0
      ? suppliedGroups
      : blocks.length > 0
        ? fallbackGroups()
        : [[]];

  pageGroups.forEach((group) => {
    let page = addContentPage();
    let y = top;

    group.forEach((blockIndex) => {
      const block = blocks[blockIndex];
      if (!block) return;

      const prepared = prepareBlockForPdf(block);
      const { layout, lines } = prepared;

      y -= layout.beforeGap;
      if (y < bottom + lineGap) {
        page = addContentPage();
        y = top - layout.beforeGap;
      }

      lines.forEach((line) => {
        if (y < bottom + lineGap) {
          page = addContentPage();
          y = top;
        }

        const text = line || " ";
        const drawingFont = fontForLayout(layout);
        const width = drawingFont.widthOfTextAtSize(text, fontSize);
        const drawX =
          layout.align === "right"
            ? layout.x + Math.max(0, layout.maxWidth - width)
            : layout.x;

        page.drawText(text, {
          x: drawX,
          y,
          size: fontSize,
          font: drawingFont,
          color: rgb(0, 0, 0),
        });

        y -= lineGap;
      });

      y -= layout.afterGap;
    });
  });

  const bytes = await pdfDoc.save();

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], { type: "application/pdf" });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeRtf(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}");
}
