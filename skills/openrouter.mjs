#!/usr/bin/env node
// Paranoia: OpenRouter probe CLI.
// Usage: see .claude/skills/openrouter/SKILL.md

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    system: { type: "string" },
    user: { type: "string" },
    "system-file": { type: "string" },
    "user-file": { type: "string" },
    fixtures: { type: "string", multiple: true },
    json: { type: "boolean", default: false },
    "max-tokens": { type: "string", default: "512" },
    temperature: { type: "string", default: "0.7" },
    health: { type: "boolean", default: false },
    debug: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const apiKey = process.env.OPENROUTER_API_KEY;
const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

if (!apiKey) {
  console.error("OPENROUTER_API_KEY not set. Source apps/server/.env first.");
  process.exit(2);
}

function readFileMaybe(p) {
  if (!p) return undefined;
  return fs.readFileSync(path.resolve(p), "utf8");
}

async function call({ model, system, user, json, maxTokens, temperature }) {
  const body = {
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: user },
    ],
    max_tokens: Number(maxTokens),
    temperature: Number(temperature),
    ...(json ? { response_format: { type: "json_object" } } : {}),
  };

  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://paranoia.krulestwo.com",
      "X-Title": "Paranoia (skill probe)",
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - t0;
  const data = await res.json();
  return { ok: res.ok, status: res.status, latencyMs, data };
}

const DEFAULT_MODEL = process.env.MODIFIER_DEFAULT_MODEL ?? "deepseek/deepseek-v4-flash";

if (values.health) {
  const out = await call({
    model: values.model ?? DEFAULT_MODEL,
    system: "Reply with the single word OK.",
    user: "ping",
    json: false,
    maxTokens: 8,
    temperature: 0,
  });
  console.log(JSON.stringify({ ok: out.ok, status: out.status, latencyMs: out.latencyMs }, null, 2));
  process.exit(out.ok ? 0 : 1);
}

if (!values.model) {
  console.error("--model is required");
  process.exit(2);
}

const system = values.system ?? readFileMaybe(values["system-file"]);
const userInline = values.user ?? readFileMaybe(values["user-file"]);

async function runOne(label, userText) {
  const out = await call({
    model: values.model,
    system,
    user: userText,
    json: values.json,
    maxTokens: values["max-tokens"],
    temperature: values.temperature,
  });
  const choice = out.data?.choices?.[0]?.message?.content ?? "";
  let parsed = null;
  let parseError = null;
  if (values.json) {
    try {
      parsed = JSON.parse(choice);
    } catch (e) {
      parseError = e.message;
    }
  }
  const usage = out.data?.usage ?? {};
  const result = {
    label,
    ok: out.ok,
    status: out.status,
    latencyMs: out.latencyMs,
    model: values.model,
    usage,
    content: choice,
    parsed,
    parseError,
  };
  console.log(JSON.stringify(result, null, 2));
  if (values.debug) console.error(JSON.stringify(out.data, null, 2));
  return result;
}

function expandGlob(pattern) {
  if (typeof fs.globSync === "function") return fs.globSync(pattern);
  // Minimal fallback: treat as a directory + simple `*.ext` pattern.
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  if (!base.includes("*")) return [pattern];
  const re = new RegExp("^" + base.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => re.test(name))
    .map((name) => path.join(dir, name));
}

if (values.fixtures && values.fixtures.length) {
  let pass = 0;
  let fail = 0;
  for (const pattern of values.fixtures) {
    const files = expandGlob(pattern);
    for (const f of files) {
      const fixture = JSON.parse(fs.readFileSync(f, "utf8"));
      const userText = fixture.user ?? fixture.message ?? JSON.stringify(fixture);
      const r = await runOne(f, userText);
      if (r.ok && (!values.json || (!r.parseError && r.parsed))) pass++;
      else fail++;
    }
  }
  console.error(`\nFixture summary: ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

if (!userInline) {
  console.error("Provide --user or --user-file (or --fixtures).");
  process.exit(2);
}

await runOne("inline", userInline);
