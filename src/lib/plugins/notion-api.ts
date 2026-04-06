/**
 * Notion Integration Helper
 *
 * Handles Notion OAuth token exchange, fetching pages and blocks from Notion API,
 * and converting Notion blocks to markdown format for Semetra notes.
 */

import { logger } from "@/lib/logger";

const log = logger("lib:notion-api");

// ── Types ────────────────────────────────────────────────────────────

export interface NotionPage {
  id: string;
  title: string;
  last_edited_time: string;
  created_time: string;
}

export interface NotionSearchResponse {
  results: Array<{
    id: string;
    properties?: Record<string, any>;
    created_time: string;
    last_edited_time: string;
    title?: string;
  }>;
  next_cursor?: string;
  has_more: boolean;
}

export interface NotionBlock {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  [key: string]: any;
}

export interface NotionBlocksResponse {
  results: NotionBlock[];
  next_cursor?: string;
  has_more: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  workspace_name?: string;
  workspace_id?: string;
  bot_id?: string;
  duplicated_template_id?: string;
  owner?: {
    type: string;
    user?: {
      id: string;
      object: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: {
        email: string;
      };
    };
    workspace?: boolean;
  };
}

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// ── Constants ────────────────────────────────────────────────────────

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";

// ── OAuth Token Management ────────────────────────────────────────────

/**
 * Exchange authorization code for access token (used in OAuth callback).
 * Returns token response with workspace details if successful.
 */
export async function exchangeCodeForToken(
  code: string,
  config: NotionOAuthConfig
): Promise<TokenResponse | null> {
  try {
    log.debug("Exchanging authorization code for token", { code: code.substring(0, 10) });

    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      log.error("Code exchange failed", { status: response.status, error });
      return null;
    }

    const data = (await response.json()) as TokenResponse;
    log.info("Token exchange successful", {
      workspace_name: data.workspace_name,
      workspace_id: data.workspace_id,
    });
    return data;
  } catch (err) {
    log.error("Token exchange error", { error: err });
    return null;
  }
}

// ── Notion API: Pages ────────────────────────────────────────────────

/**
 * Search for pages in the Notion workspace.
 * Returns a list of pages accessible by the bot.
 */
export async function searchNotionPages(
  accessToken: string,
  query?: string,
  pageSize: number = 100
): Promise<NotionPage[]> {
  try {
    log.debug("Searching Notion pages", { query, pageSize });

    const pages: NotionPage[] = [];
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      const body: any = {
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: Math.min(pageSize, 100),
      };

      if (nextCursor) {
        body.start_cursor = nextCursor;
      }

      if (query) {
        body.query = query;
      }

      const response = await fetch(`${NOTION_API_BASE}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": NOTION_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        log.error("Search pages failed", { status: response.status, error });
        break;
      }

      const data = (await response.json()) as NotionSearchResponse;

      for (const result of data.results) {
        const title = extractPageTitle(result);
        if (title) {
          pages.push({
            id: result.id,
            title,
            last_edited_time: result.last_edited_time,
            created_time: result.created_time,
          });
        }
      }

      hasMore = data.has_more;
      nextCursor = data.next_cursor || undefined;
    }

    log.info("Found pages", { count: pages.length });
    return pages;
  } catch (err) {
    log.error("Search pages error", { error: err });
    return [];
  }
}

/**
 * Get page metadata directly by ID.
 */
export async function getNotionPageMetadata(
  accessToken: string,
  pageId: string
): Promise<NotionPage | null> {
  try {
    const cleanId = pageId.replace(/-/g, "");

    const response = await fetch(`${NOTION_API_BASE}/pages/${cleanId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_API_VERSION,
      },
    });

    if (!response.ok) {
      log.error("Get page failed", { status: response.status, pageId });
      return null;
    }

    const data = await response.json();
    const title = extractPageTitle(data);

    if (!title) {
      log.warn("Page has no title", { pageId });
      return null;
    }

    return {
      id: data.id,
      title,
      last_edited_time: data.last_edited_time,
      created_time: data.created_time,
    };
  } catch (err) {
    log.error("Get page error", { error: err, pageId });
    return null;
  }
}

// ── Notion API: Blocks ───────────────────────────────────────────────

/**
 * Fetch all blocks for a page recursively.
 * Handles pagination and nested blocks (children).
 */
export async function fetchNotionPageBlocks(
  accessToken: string,
  pageId: string
): Promise<NotionBlock[]> {
  try {
    const cleanId = pageId.replace(/-/g, "");
    const blocks: NotionBlock[] = [];

    log.debug("Fetching blocks for page", { pageId: cleanId });

    const queue: Array<{ parentId: string; depth: number }> = [
      { parentId: cleanId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { parentId, depth } = queue.shift()!;

      if (depth > 10) {
        log.warn("Max nesting depth reached, skipping further blocks", {
          parentId,
        });
        continue;
      }

      let hasMore = true;
      let nextCursor: string | undefined;

      while (hasMore) {
        const url = new URL(`${NOTION_API_BASE}/blocks/${parentId}/children`);
        if (nextCursor) {
          url.searchParams.set("start_cursor", nextCursor);
        }
        url.searchParams.set("page_size", "100");

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Notion-Version": NOTION_API_VERSION,
          },
        });

        if (!response.ok) {
          log.error("Fetch blocks failed", {
            status: response.status,
            parentId,
          });
          break;
        }

        const data = (await response.json()) as NotionBlocksResponse;

        for (const block of data.results) {
          blocks.push(block);

          // Queue children blocks if they exist
          if (block.has_children) {
            queue.push({ parentId: block.id, depth: depth + 1 });
          }
        }

        hasMore = data.has_more;
        nextCursor = data.next_cursor || undefined;
      }
    }

    log.info("Fetched blocks for page", { count: blocks.length, pageId: cleanId });
    return blocks;
  } catch (err) {
    log.error("Fetch blocks error", { error: err, pageId });
    return [];
  }
}

// ── Block to Markdown Conversion ─────────────────────────────────────

/**
 * Convert Notion blocks to markdown format.
 * Handles all common block types.
 */
export function convertBlocksToMarkdown(blocks: NotionBlock[]): string {
  const markdownLines: string[] = [];
  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  for (const block of blocks) {
    const markdown = convertBlockToMarkdown(block);
    if (markdown) {
      markdownLines.push(markdown);
    }
  }

  return markdownLines.join("\n\n").trim();
}

/**
 * Convert a single Notion block to markdown.
 */
function convertBlockToMarkdown(block: NotionBlock): string {
  try {
    switch (block.type) {
      case "paragraph":
        return convertParagraph(block);
      case "heading_1":
        return convertHeading(block, 1);
      case "heading_2":
        return convertHeading(block, 2);
      case "heading_3":
        return convertHeading(block, 3);
      case "bulleted_list_item":
        return convertBulletedListItem(block);
      case "numbered_list_item":
        return convertNumberedListItem(block);
      case "to_do":
        return convertTodo(block);
      case "code":
        return convertCode(block);
      case "quote":
        return convertQuote(block);
      case "callout":
        return convertCallout(block);
      case "image":
        return convertImage(block);
      case "divider":
        return convertDivider();
      case "toggle":
        return convertToggle(block);
      default:
        log.debug("Unknown block type", { type: block.type });
        return "";
    }
  } catch (err) {
    log.warn("Failed to convert block", { error: err, blockType: block.type });
    return "";
  }
}

function convertParagraph(block: NotionBlock): string {
  if (!block.paragraph) return "";
  const text = extractRichText(block.paragraph.rich_text);
  if (!text) return "";
  return text;
}

function convertHeading(block: NotionBlock, level: number): string {
  const key = `heading_${level}`;
  if (!block[key]) return "";
  const text = extractRichText(block[key].rich_text);
  if (!text) return "";
  return `${"#".repeat(level)} ${text}`;
}

function convertBulletedListItem(block: NotionBlock): string {
  if (!block.bulleted_list_item) return "";
  const text = extractRichText(block.bulleted_list_item.rich_text);
  if (!text) return "";
  return `- ${text}`;
}

function convertNumberedListItem(block: NotionBlock): string {
  if (!block.numbered_list_item) return "";
  const text = extractRichText(block.numbered_list_item.rich_text);
  if (!text) return "";
  return `1. ${text}`;
}

function convertTodo(block: NotionBlock): string {
  if (!block.to_do) return "";
  const text = extractRichText(block.to_do.rich_text);
  if (!text) return "";
  const checkbox = block.to_do.checked ? "[x]" : "[ ]";
  return `${checkbox} ${text}`;
}

function convertCode(block: NotionBlock): string {
  if (!block.code) return "";
  const text = extractRichText(block.code.rich_text);
  if (!text) return "";
  const language = block.code.language || "text";
  return `\`\`\`${language}\n${text}\n\`\`\``;
}

function convertQuote(block: NotionBlock): string {
  if (!block.quote) return "";
  const text = extractRichText(block.quote.rich_text);
  if (!text) return "";
  return `> ${text}`;
}

function convertCallout(block: NotionBlock): string {
  if (!block.callout) return "";
  const text = extractRichText(block.callout.rich_text);
  const icon = block.callout.icon?.emoji || "ℹ️";
  if (!text) return "";
  return `> ${icon} ${text}`;
}

function convertImage(block: NotionBlock): string {
  if (!block.image) return "";

  let url = "";
  if (block.image.type === "external" && block.image.external?.url) {
    url = block.image.external.url;
  } else if (block.image.type === "file" && block.image.file?.url) {
    url = block.image.file.url;
  }

  if (!url) return "";

  const caption = extractRichText(block.image.caption || []);
  const alt = caption || "image";

  return `![${alt}](${url})`;
}

function convertDivider(): string {
  return "---";
}

function convertToggle(block: NotionBlock): string {
  if (!block.toggle) return "";
  const text = extractRichText(block.toggle.rich_text);
  if (!text) return "";
  return `<details>\n<summary>${text}</summary>\n</details>`;
}

/**
 * Extract plain text from Notion's rich text array.
 */
function extractRichText(richText: any[]): string {
  if (!Array.isArray(richText)) return "";

  const parts: string[] = [];

  for (const item of richText) {
    let text = "";

    if (item.type === "text" && item.text) {
      text = item.text.content;

      // Apply formatting
      if (item.annotations) {
        if (item.annotations.bold) text = `**${text}**`;
        if (item.annotations.italic) text = `*${text}*`;
        if (item.annotations.strikethrough) text = `~~${text}~~`;
        if (item.annotations.code) text = `\`${text}\``;
      }

      // Handle links
      if (item.href) {
        text = `[${text}](${item.href})`;
      }
    } else if (item.type === "mention" && item.mention) {
      const mention = item.mention;
      if (mention.type === "user" && mention.user?.name) {
        text = `@${mention.user.name}`;
      } else if (mention.type === "page" && mention.page?.id) {
        text = mention.page.id;
      } else if (mention.type === "date" && mention.date?.start) {
        text = mention.date.start;
      }
    } else if (item.type === "equation" && item.equation?.expression) {
      text = `$${item.equation.expression}$`;
    }

    if (text) {
      parts.push(text);
    }
  }

  return parts.join("");
}

/**
 * Extract page title from Notion page object.
 */
function extractPageTitle(page: any): string {
  // Try to get title from properties (database pages)
  if (page.properties) {
    for (const [, prop] of Object.entries(page.properties)) {
      const p = prop as any;
      if (p.type === "title" && p.title && Array.isArray(p.title)) {
        const title = extractRichText(p.title);
        if (title) return title;
      }
    }
  }

  // Try to get title from parent if it's a page in a database
  if (page.parent?.type === "page_id") {
    return `Page ${page.id.substring(0, 8)}`;
  }

  // Default to page ID if no title found
  return `Page ${page.id.substring(0, 8)}`;
}

/**
 * Sanitize Notion page ID (remove hyphens for internal API calls).
 */
export function sanitizePageId(pageId: string): string {
  return pageId.replace(/-/g, "");
}

/**
 * Format page ID with hyphens for display.
 */
export function formatPageId(pageId: string): string {
  const clean = pageId.replace(/-/g, "");
  if (clean.length === 32) {
    return `${clean.substring(0, 8)}-${clean.substring(8, 12)}-${clean.substring(12, 16)}-${clean.substring(16, 20)}-${clean.substring(20)}`;
  }
  return clean;
}
