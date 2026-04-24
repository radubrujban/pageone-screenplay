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
};

export const defaultFormat: FormatSettings = {
  pageWidth: 8.5,
  pageHeight: 11,
  topMargin: 1,
  bottomMargin: 1,
  leftMargin: 1.5,
  rightMargin: 1,
  fontSize: 12,
  lineHeight: 1.1,
  characterIndent: 3.7,
  dialogueIndent: 2.5,
  dialogueWidth: 3.5,
  showSceneNumbers: true,
};

export const blockTypes: ScriptBlock["type"][] = [
  "scene",
  "action",
  "character",
  "dialogue",
];

export const revisionColors: RevisionColor[] = [
  "none",
  "blue",
  "pink",
  "yellow",
  "green",
  "orange",
];

export function detectType(text: string, currentType: ScriptBlock["type"]) {
  const trimmed = text.trim();

  if (trimmed.startsWith("INT.") || trimmed.startsWith("EXT.")) return "scene";
  if (currentType !== "action") return currentType;
  if (/^[A-Z\s]{2,30}$/.test(trimmed) && trimmed.length > 0) return "character";
  if (trimmed.startsWith("(")) return "dialogue";

  return "action";
}

export function getNextType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  if (type === "scene") return "action";
  if (type === "action") return "character";
  if (type === "character") return "dialogue";
  return "action";
}

export function getPreviousType(type: ScriptBlock["type"]): ScriptBlock["type"] {
  const index = blockTypes.indexOf(type);
  return blockTypes[(index - 1 + blockTypes.length) % blockTypes.length];
}

export function blockToText(block: ScriptBlock) {
  if (block.type === "scene") return block.text.toUpperCase();
  if (block.type === "character") return `\n${block.text.toUpperCase()}`;
  if (block.type === "dialogue") return `    ${block.text}`;
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
  const metadata = exportSettings.includeMetadata
    ? [
        `Title: ${titlePage.title || title}`,
        titlePage.writtenBy ? `Author: ${titlePage.writtenBy}` : "",
        titlePage.basedOn ? `Source: ${titlePage.basedOn}` : "",
        titlePage.draftDate ? `Draft date: ${titlePage.draftDate}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const body = blocks.map(blockToText).join("\n\n");
  return `${metadata}${body}`;
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
      if (block.type === "scene")
        return `\\ql\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      if (block.type === "character")
        return `\\li3600\\b ${escapeRtf(block.text.toUpperCase())}\\b0\\par`;
      if (block.type === "dialogue")
        return `\\li1800\\ri1800 ${escapeRtf(block.text)}\\par`;
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
        block.type === "scene"
          ? "Scene Heading"
          : block.type === "action"
            ? "Action"
            : block.type === "character"
              ? "Character"
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

export async function buildPdfBlob({
  blocks,
  title,
  titlePage,
  exportSettings,
  format,
}: PdfBuildInput) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const pageWidth = format.pageWidth * 72;
  const pageHeight = format.pageHeight * 72;
  const left = format.leftMargin * 72;
  const right = format.rightMargin * 72;
  const top = pageHeight - format.topMargin * 72;
  const bottom = format.bottomMargin * 72;
  const fontSize = format.fontSize;
  const lineGap = fontSize * format.lineHeight;
  const contentMaxWidth = pageWidth - left - right;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = top;

  function addPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = top;
  }

  function drawLine(text: string, x: number, bold = false) {
    if (y < bottom) addPage();

    page.drawText(text || " ", {
      x,
      y,
      size: fontSize,
      font: bold ? courierBold : courier,
      color: rgb(0, 0, 0),
    });

    y -= lineGap;
  }

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

  for (const block of blocks) {
    const text =
      block.type === "scene" || block.type === "character"
        ? block.text.toUpperCase()
        : block.text;

    const bold = block.type === "scene" || block.type === "character";
    const x =
      block.type === "character"
        ? format.characterIndent * 72
        : block.type === "dialogue"
          ? format.dialogueIndent * 72
          : left;

    const maxWidth =
      block.type === "dialogue" ? format.dialogueWidth * 72 : contentMaxWidth;

    const approxChars = Math.max(10, Math.floor(maxWidth / (fontSize * 0.6)));
    const lines = wrapText(text || "", approxChars);

    if (block.type === "scene" || block.type === "character") {
      y -= lineGap * 0.5;
    }

    for (const line of lines.length ? lines : [""]) {
      drawLine(line, x, bold);
    }

    if (block.type === "dialogue") y -= lineGap * 0.4;
  }

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

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current.trim()) lines.push(current.trim());
  return lines;
}
