/**
 * Notion-Import Plugin API Route
 *
 * Handles Notion integration:
 * - GET: Returns connection status
 * - POST with action="connect": Initiates OAuth flow
 * - POST with action="callback": Handles OAuth callback
 * - POST with action="disconnect": Removes tokens
 * - POST with action="list-pages": Lists available Notion pages
 * - POST with action="import": Imports selected pages into Semetra notes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  exchangeCodeForToken,
  searchNotionPages,
  fetchNotionPageBlocks,
  convertBlocksToMarkdown,
  getNotionPageMetadata,
  sanitizePageId,
  type NotionPage,
  type TokenResponse,
} from "@/lib/plugins/notion-api";

const log = logger("api:notion-import");

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || "";
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/plugins/notion-import/callback`;

interface NotionImportConfig {
  access_token?: string;
  workspace_name?: string;
  workspace_id?: string;
  bot_id?: string;
  last_import?: number;
  imported_pages?: string[]; // Track imported page IDs
}

// ── GET: Return connection status ────────────────────────────────────

/**
 * GET /api/plugins/notion-import
 *
 * Returns:
 * - connected: boolean indicating if Notion workspace is connected
 * - workspace_name: name of connected Notion workspace (if any)
 * - last_import: timestamp of last successful import
 * - imported_page_count: number of pages imported
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", user.id)
      .eq("plugin_id", "notion-import")
      .single();

    if (pluginError) {
      log.debug("Plugin not installed", { userId: user.id });
      return NextResponse.json(
        {
          connected: false,
          last_import: null,
          workspace_name: null,
          imported_page_count: 0,
          message: "Plugin nicht installiert",
        },
        { status: 200 }
      );
    }

    const config = (pluginData?.config || {}) as NotionImportConfig;
    const importedPages = config.imported_pages || [];

    return NextResponse.json({
      connected: !!config.access_token && !!config.workspace_name,
      last_import: config.last_import || null,
      workspace_name: config.workspace_name || null,
      imported_page_count: importedPages.length,
    });
  } catch (err: unknown) {
    log.error("GET failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Verbindungsstatus" },
      { status: 500 }
    );
  }
}

// ── POST: Handle actions ─────────────────────────────────────────────

/**
 * POST /api/plugins/notion-import
 *
 * Body: { action: "connect"|"callback"|"disconnect"|"list-pages"|"import", ... }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "connect":
        return handleConnect();
      case "callback":
        return handleCallback(user.id, body, supabase);
      case "disconnect":
        return handleDisconnect(user.id, supabase);
      case "list-pages":
        return handleListPages(user.id, supabase);
      case "import":
        return handleImport(user.id, body, supabase);
      default:
        return NextResponse.json(
          { error: "Ungültige Aktion" },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    log.error("POST failed", { error: err });
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Interner Fehler",
      },
      { status: 500 }
    );
  }
}

// ── Action Handlers ──────────────────────────────────────────────────

/**
 * Generate Notion OAuth URL for user to authorize.
 */
function handleConnect() {
  try {
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      owner: "user",
    });

    const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

    log.info("Generated Notion OAuth URL");

    return NextResponse.json({
      auth_url: authUrl,
      message: "Bitte melden Sie sich bei Notion an",
    });
  } catch (err: unknown) {
    log.error("handleConnect failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Generieren der OAuth-URL" },
      { status: 500 }
    );
  }
}

/**
 * Handle OAuth callback with authorization code.
 * Exchanges code for tokens and stores them.
 */
async function handleCallback(
  userId: string,
  body: any,
  supabase: any
) {
  try {
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Autorisierungscode erforderlich" },
        { status: 400 }
      );
    }

    // Exchange code for token
    const tokens = await exchangeCodeForToken(code, {
      clientId: NOTION_CLIENT_ID,
      clientSecret: NOTION_CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    });

    if (!tokens) {
      return NextResponse.json(
        { error: "Token-Austausch fehlgeschlagen" },
        { status: 401 }
      );
    }

    // Extract workspace info from token response
    const config: NotionImportConfig = {
      access_token: tokens.access_token,
      workspace_name: tokens.workspace_name || "Notion Workspace",
      workspace_id: tokens.workspace_id,
      bot_id: tokens.bot_id,
      last_import: Date.now(),
      imported_pages: [],
    };

    // Ensure plugin is installed first
    const { data: existing } = await supabase
      .from("user_plugins")
      .select("id")
      .eq("user_id", userId)
      .eq("plugin_id", "notion-import")
      .single();

    if (!existing) {
      // Install plugin
      const { error: installError } = await supabase
        .from("user_plugins")
        .insert({
          user_id: userId,
          plugin_id: "notion-import",
          enabled: true,
          config,
        });

      if (installError) {
        log.error("Failed to install plugin", { error: installError });
        return NextResponse.json(
          { error: "Fehler beim Installieren des Plugins" },
          { status: 500 }
        );
      }
    } else {
      // Update existing
      const { error: updateError } = await supabase
        .from("user_plugins")
        .update({ config, enabled: true })
        .eq("user_id", userId)
        .eq("plugin_id", "notion-import");

      if (updateError) {
        log.error("Failed to update plugin config", { error: updateError });
        return NextResponse.json(
          { error: "Fehler beim Aktualisieren der Konfiguration" },
          { status: 500 }
        );
      }
    }

    log.info("OAuth callback successful", {
      userId,
      workspace_name: config.workspace_name,
      workspace_id: config.workspace_id,
    });

    return NextResponse.json({
      ok: true,
      workspace_name: config.workspace_name,
      message: `Notion erfolgreich verbunden: ${config.workspace_name}`,
    });
  } catch (err: unknown) {
    log.error("handleCallback failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des Callbacks" },
      { status: 500 }
    );
  }
}

/**
 * Remove stored Notion tokens and disconnect.
 */
async function handleDisconnect(userId: string, supabase: any) {
  try {
    const { error } = await supabase
      .from("user_plugins")
      .update({
        config: {
          imported_pages: [],
        },
      })
      .eq("user_id", userId)
      .eq("plugin_id", "notion-import");

    if (error) {
      log.error("Disconnect update failed", { error });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    log.info("User disconnected Notion", { userId });

    return NextResponse.json({
      ok: true,
      message: "Notion erfolgreich disconnected",
    });
  } catch (err: unknown) {
    log.error("handleDisconnect failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Trennen" },
      { status: 500 }
    );
  }
}

/**
 * List available Notion pages from connected workspace.
 */
async function handleListPages(userId: string, supabase: any) {
  try {
    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", userId)
      .eq("plugin_id", "notion-import")
      .single();

    if (pluginError || !pluginData) {
      return NextResponse.json(
        { error: "Plugin nicht installiert oder konfiguriert" },
        { status: 400 }
      );
    }

    const config = (pluginData.config || {}) as NotionImportConfig;

    if (!config.access_token) {
      return NextResponse.json(
        { error: "Notion nicht verbunden" },
        { status: 400 }
      );
    }

    log.info("Listing Notion pages", { userId });

    // Search for pages in Notion workspace
    const pages = await searchNotionPages(config.access_token);

    log.info("Listed pages", { count: pages.length, userId });

    return NextResponse.json({
      ok: true,
      pages: pages.map((p) => ({
        id: p.id,
        title: p.title,
        last_edited: p.last_edited_time,
        created: p.created_time,
      })),
    });
  } catch (err: unknown) {
    log.error("handleListPages failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Seiten" },
      { status: 500 }
    );
  }
}

/**
 * Import selected Notion pages into Semetra notes.
 */
async function handleImport(
  userId: string,
  body: any,
  supabase: any
) {
  try {
    const { pageIds } = body;

    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        { error: "pageIds erforderlich und muss ein Array sein" },
        { status: 400 }
      );
    }

    // Get user's plugin config
    const { data: pluginData, error: pluginError } = await supabase
      .from("user_plugins")
      .select("config")
      .eq("user_id", userId)
      .eq("plugin_id", "notion-import")
      .single();

    if (pluginError || !pluginData) {
      return NextResponse.json(
        { error: "Plugin nicht installiert oder konfiguriert" },
        { status: 400 }
      );
    }

    const config = (pluginData.config || {}) as NotionImportConfig;

    if (!config.access_token) {
      return NextResponse.json(
        { error: "Notion nicht verbunden" },
        { status: 400 }
      );
    }

    log.info("Starting import", { userId, pageCount: pageIds.length });

    const importedPages: NotionPage[] = [];
    const errors: Array<{ pageId: string; error: string }> = [];

    for (const pageId of pageIds) {
      try {
        // Get page metadata
        const page = await getNotionPageMetadata(config.access_token, pageId);
        if (!page) {
          errors.push({ pageId, error: "Seite nicht gefunden" });
          continue;
        }

        // Fetch blocks for page
        const blocks = await fetchNotionPageBlocks(config.access_token, pageId);
        const markdown = convertBlocksToMarkdown(blocks);

        // Check if page already imported
        const { data: existing } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", userId)
          .eq("source", "notion")
          .eq("source_id", pageId)
          .single();

        if (existing) {
          // Update existing note
          const { error: updateError } = await supabase
            .from("notes")
            .update({
              title: page.title,
              content: markdown,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            log.error("Failed to update note", { error: updateError, pageId });
            errors.push({ pageId, error: "Fehler beim Aktualisieren" });
          } else {
            importedPages.push(page);
            log.debug("Updated note from Notion", { pageId, userId });
          }
        } else {
          // Insert new note
          const { error: insertError } = await supabase
            .from("notes")
            .insert({
              user_id: userId,
              title: page.title,
              content: markdown,
              source: "notion",
              source_id: pageId,
              color: "#8b5cf6", // Purple for Notion notes
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            log.error("Failed to insert note", { error: insertError, pageId });
            errors.push({ pageId, error: "Fehler beim Importieren" });
          } else {
            importedPages.push(page);
            log.debug("Imported note from Notion", { pageId, userId });
          }
        }
      } catch (err: unknown) {
        log.warn("Failed to import page", {
          error: err instanceof Error ? err.message : String(err),
          pageId,
        });
        errors.push({
          pageId,
          error: err instanceof Error ? err.message : "Unbekannter Fehler",
        });
      }
    }

    // Update config with imported page list
    const importedPageIds = new Set(
      config.imported_pages || []
    );
    for (const page of importedPages) {
      importedPageIds.add(page.id);
    }

    const updatedConfig: NotionImportConfig = {
      ...config,
      last_import: Date.now(),
      imported_pages: Array.from(importedPageIds),
    };

    const { error: configError } = await supabase
      .from("user_plugins")
      .update({ config: updatedConfig })
      .eq("user_id", userId)
      .eq("plugin_id", "notion-import");

    if (configError) {
      log.error("Failed to update import config", { error: configError });
    }

    log.info("Import completed", {
      userId,
      imported: importedPages.length,
      errors: errors.length,
    });

    return NextResponse.json({
      ok: true,
      imported: importedPages.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${importedPages.length} Seite(n) importiert${errors.length > 0 ? `, ${errors.length} Fehler` : ""}`,
    });
  } catch (err: unknown) {
    log.error("handleImport failed", { error: err });
    return NextResponse.json(
      { error: "Fehler beim Importieren von Seiten" },
      { status: 500 }
    );
  }
}
