#!/usr/bin/env node
/**
 * Generates web client card data from the server's CARD_TEMPLATES.
 * Run from repo root after building the server: cd server && npm run build
 * Then: node scripts/generate-card-data.mjs
 *
 * Security: Card definitions come only from the server. The client never
 * sends or invents card data; this script runs at build time from server output.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const serverCardsPath = join(root, "server", "dist", "game", "cards.js");
const serverCardsUrl = pathToFileURL(serverCardsPath).href;
const outDir = join(root, "web", "src", "generated");
const outPath = join(outDir, "cardData.ts");

// Load server CARD_TEMPLATES from compiled output (server must be built first)
let CARD_TEMPLATES;
try {
  const module = await import(serverCardsUrl);
  CARD_TEMPLATES = module.CARD_TEMPLATES;
} catch (err) {
  console.error("Failed to load server card definitions. Build the server first: cd server && npm run build");
  console.error(err.message);
  process.exit(1);
}

if (!Array.isArray(CARD_TEMPLATES)) {
  console.error("CARD_TEMPLATES not found or not an array in server/dist/game/cards.js");
  process.exit(1);
}

const lines = [
  "/** Auto-generated from server/game/cards.ts. Do not edit by hand. Run: node scripts/generate-card-data.mjs */",
  "",
  "export interface CardTemplate {",
  "  id: string;",
  "  name: string;",
  "  type: \"creature\" | \"spell\";",
  "  cost: number;",
  "  attack?: number;",
  "  health?: number;",
  "  spellPower?: number;",
  "  keywords?: string[];",
  "  flavorText?: string;",
  "  requiresTarget?: boolean;",
  "  spellEffect?: \"damage\" | \"draw\" | \"summon_random\" | \"create_persistent\";",
  "  spellDraw?: number;",
  "  spellSummonPool?: string[];",
  "  triggers?: { event: string; effect: { type: string; value?: number } }[];",
  "  spellPersistent?: { triggerPhase: string; duration: number; effect: Record<string, unknown> };",
  "}",
  "",
  "export const CARD_TEMPLATES: CardTemplate[] = " +
    JSON.stringify(CARD_TEMPLATES, null, 2)
      .replace(/"([^"]+)":/g, "$1:")
      .replace(/^/m, "  ") +
    ";",
  "",
  "const byId = new Map(CARD_TEMPLATES.map((c) => [c.id, c]));",
  "",
  "export function getCardTemplate(cardId: string): CardTemplate | undefined {",
  "  return byId.get(cardId);",
  "}",
  "",
];

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("Wrote", outPath);
