import { writeFileSync, mkdirSync } from "node:fs";
import { exec } from "node:child_process";
import { join } from "node:path";
import type { EmailAttachment } from "../types/index";

const PREVIEW_DIR = join(process.cwd(), ".email-preview");
const PREVIEW_FILE = join(PREVIEW_DIR, "last.html");

interface PreviewOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

function resolveCidReferences(html: string, attachments: EmailAttachment[]): string {
  let resolved = html;
  for (const att of attachments) {
    if (!att.content_id) continue;
    const mime = att.content_type ?? "image/png";
    const b64 = Buffer.isBuffer(att.content)
      ? att.content.toString("base64")
      : att.content;
    resolved = resolved.replaceAll(
      `cid:${att.content_id}`,
      `data:${mime};base64,${b64}`,
    );
  }
  return resolved;
}

function buildPreviewPage({ to, subject, html, attachments = [] }: PreviewOptions): string {
  html = resolveCidReferences(html, attachments);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Preview: ${subject}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; }
    .meta {
      position: sticky; top: 0; z-index: 10;
      background: #1a1a1a; color: #e5e5e5;
      padding: 12px 20px; font-size: 13px;
      display: flex; gap: 24px; align-items: center;
      border-bottom: 3px solid #f59e0b;
    }
    .meta strong { color: #f59e0b; }
    .badge {
      margin-left: auto; background: #f59e0b; color: #1a1a1a;
      font-weight: 700; font-size: 11px; letter-spacing: 0.05em;
      padding: 3px 8px; border-radius: 4px; text-transform: uppercase;
    }
    .email-body { max-width: 680px; margin: 32px auto; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
    .email-content { padding: 32px; }
  </style>
</head>
<body>
  <div class="meta">
    <span><strong>To:</strong> ${to}</span>
    <span><strong>Subject:</strong> ${subject}</span>
    <span class="badge">mock — not sent</span>
  </div>
  <div class="email-body">
    <div class="email-content">
      ${html}
    </div>
  </div>
</body>
</html>`;
}

function openInBrowser(filePath: string): void {
  if (process.platform === "win32") {
    exec(`start "" "${filePath}"`, { shell: "cmd.exe" });
  } else {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${cmd} "${filePath}"`);
  }
}

export function writeEmailPreview(options: PreviewOptions): void {
  mkdirSync(PREVIEW_DIR, { recursive: true });
  writeFileSync(PREVIEW_FILE, buildPreviewPage(options), "utf-8");
  openInBrowser(PREVIEW_FILE);
}
