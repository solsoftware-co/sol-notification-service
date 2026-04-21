import { JWT } from "google-auth-library";
import { log, logError } from "../utils/logger";
import type { GoogleSheetsDestination } from "../types/index";

export interface SheetAppendResult {
  success: boolean;
  rowsAppended?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

async function getSheetsAccessToken(credentialsJson: string): Promise<string> {
  const creds = JSON.parse(credentialsJson) as {
    client_email: string;
    private_key: string;
  };
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const tokenResponse = await auth.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain access token from service account");
  }
  return tokenResponse.token;
}

export function buildRange(destination: GoogleSheetsDestination): string {
  const cell = destination.tableAnchor ?? "A1";
  return destination.sheetName ? `${destination.sheetName}!${cell}` : cell;
}

export function resolveRow(
  destination: GoogleSheetsDestination,
  fields: Record<string, string>,
  timestamp: string
): string[] {
  if (!destination.columns) {
    return [timestamp, ...Object.values(fields)];
  }
  return destination.columns.map((col) =>
    col === "_timestamp" ? timestamp : (fields[col] ?? "")
  );
}

export async function appendSheetRow(
  credentialsJson: string,
  destination: GoogleSheetsDestination,
  fields: Record<string, string>,
  timestamp: string
): Promise<SheetAppendResult> {
  try {
    const accessToken = await getSheetsAccessToken(credentialsJson);
    const row = resolveRow(destination, fields, timestamp);
    const range = buildRange(destination);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    log(`Appending row to sheet ${destination.spreadsheetId} — range: ${range}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sheets API ${response.status}: ${errText}`);
    }

    const body = (await response.json()) as {
      updates?: { updatedRows?: number };
    };
    const rowsAppended = body.updates?.updatedRows ?? 1;
    log(`Row appended to sheet ${destination.spreadsheetId} — ${rowsAppended} row(s) written`);
    return { success: true, rowsAppended };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(`Failed to append row to sheet ${destination.spreadsheetId}: ${message}`, err);
    return { success: false, error: message };
  }
}
