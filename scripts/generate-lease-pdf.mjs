import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { meridianLeasePages } from "../src/lease-source.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "public", "assets", "documents", "meridian-house-office-lease-demo.pdf");

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text, width = 86) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    lines.push("");
  }
  return lines;
}

function textCommand(text, x, y, font = "F1", size = 10) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`;
}

function pageStream(page, pageNumber, totalPages) {
  const commands = [
    "0.04 0.11 0.16 rg",
    "44 782 507 34 re f",
    "0.82 0.61 0.29 rg",
    textCommand("AURELIA  |  DEMONSTRATION LEASE", 58, 794, "F2", 9),
    "0.04 0.11 0.16 rg",
    textCommand(page.title, 50, 748, "F2", 16),
    "0.74 0.76 0.74 RG",
    "50 735 m 545 735 l S"
  ];

  let y = 710;
  const lines = wrapText(page.body);
  if (lines.length > 48) {
    throw new Error(`Page ${pageNumber} exceeds the PDF layout limit (${lines.length} lines).`);
  }
  for (const line of lines) {
    if (line) commands.push(textCommand(line, 54, y, "F1", 9.5));
    y -= line ? 14 : 8;
  }

  commands.push(
    "0.74 0.76 0.74 RG",
    "50 52 m 545 52 l S",
    "0.36 0.40 0.42 rg",
    textCommand("Fictional document for Agency AI demonstration only", 50, 34, "F1", 8),
    textCommand(`Page ${pageNumber} of ${totalPages}`, 485, 34, "F1", 8)
  );
  return commands.join("\n");
}

function buildPdf(pages) {
  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds = [];
  let nextId = 5;
  pages.forEach((page, index) => {
    const pageId = nextId++;
    const contentId = nextId++;
    const stream = pageStream(page, index + 1, pages.length);
    pageIds.push(pageId);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  });
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  let pdf = "%PDF-1.4\n% Aurelia generated demonstration document\n";
  const offsets = [0];
  for (let id = 1; id < nextId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${nextId}\n0000000000 65535 f \n`;
  for (let id = 1; id < nextId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, buildPdf(meridianLeasePages));
console.log(`Generated ${meridianLeasePages.length}-page lease PDF at ${outputPath}`);
