/// <reference types="node" />
import { ORPCError } from "@orpc/server";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { z } from "zod";
import { base } from "../__core/app";

const MAX_BYTES = 2 * 1024 * 1024;
let activeLoads = 0;

function publicIpv4(address: string): boolean {
  const [a, b, c] = address.split(".").map(Number);
  if (a === undefined || b === undefined || c === undefined) return false;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function validateUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete page URL, such as https://uckg.org/your-page.");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("Use a public HTTP or HTTPS URL without a username or password.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Only standard web ports are supported.");
  }
  url.hash = "";
  return url;
}

type PageResponse = { redirect?: string; content?: string };

async function getPage(url: URL, signal: AbortSignal): Promise<PageResponse> {
  // Resolve once and pin the connection to that address. Redirect destinations
  // go through the same check, preventing access to localhost/private networks.
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicIpv4(address))) {
    throw new Error("Only public websites can be loaded; private or local addresses are blocked.");
  }
  const address = addresses[0]!.address;
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      agent: false,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address, family: 4 }]);
        else callback(null, address, 4);
      },
      headers: {
        "User-Agent": "ClarityCheck/1.0 (page clarity audit)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "Accept-Encoding": "identity",
      },
    }, (res) => {
      const status = res.statusCode ?? 500;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        resolve({ redirect: res.headers.location });
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`The website returned HTTP ${status}. It may block automated requests. Upload its saved HTML or paste its source instead.`));
        return;
      }
      const type = res.headers["content-type"] ?? "";
      if (!/^(?:text\/(?:html|plain|markdown)|application\/xhtml\+xml)\b/i.test(type)) {
        res.resume();
        reject(new Error("That URL did not return an HTML or text page. Upload an HTML, text or Markdown file instead."));
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          req.destroy(new Error("This page is larger than the 2 MB URL-loading limit. Upload a saved file instead."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const charset = type.match(/charset=["']?([^;\s"']+)/i)?.[1] ?? "utf-8";
        let content: string;
        try {
          content = new TextDecoder(charset).decode(buffer);
        } catch {
          content = buffer.toString("utf8");
        }
        resolve({ content });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export const pageLoader = {
  load: base.input(z.object({ url: z.string().trim().min(1).max(2048) })).handler(async ({ input }) => {
    if (activeLoads >= 4) {
      throw new ORPCError("TOO_MANY_REQUESTS", { message: "The page loader is busy. Try again in a moment." });
    }
    activeLoads += 1;
    const signal = AbortSignal.timeout(20_000);
    try {
      let url = validateUrl(input.url);
      for (let hop = 0; hop <= 5; hop += 1) {
        const result = await getPage(url, signal);
        if (result.redirect) {
          url = validateUrl(new URL(result.redirect, url).href);
          continue;
        }
        if (!result.content?.trim()) throw new Error("The website returned an empty page. Try loading a saved HTML file instead.");
        return { content: result.content, url: url.href };
      }
      throw new Error("Too many redirects. Use the final page URL or upload its saved HTML.");
    } catch (error) {
      const message = signal.aborted
        ? "Loading timed out after 20 seconds. Try again or upload the page's saved HTML."
        : error instanceof Error ? error.message : "Could not load the page.";
      throw new ORPCError("BAD_REQUEST", { message });
    } finally {
      activeLoads -= 1;
    }
  }),
};