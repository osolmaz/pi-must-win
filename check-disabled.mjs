#!/usr/bin/env node
// Decide whether the repository in the current working directory is disabled.
// Exit 0: disabled (the caller skips attribution). Exit 1: anything else, including errors.
//
// Entries arrive pre-normalized from the extension as JSON arrays in
// PI_MUST_WIN_DISABLED_URLS (lowercase host/path keys, prefix-matched on segments) and
// PI_MUST_WIN_DISABLED_PATHS (realpath-resolved absolute clone paths, exact match).
// Both lists empty exits 1 without spawning Git.

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/** @param {string} name @returns {string[]} */
function readList(name) {
  try {
    const value = JSON.parse(process.env[name] ?? "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** @param {string[]} args @returns {string | undefined} */
function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  } catch {
    return undefined;
  }
}

/** @param {string} value @returns {string} */
function normalizeUrl(value) {
  let text = value.trim().toLowerCase();
  const hadScheme = /^(https?|ssh|git):\/\//.test(text);
  text = text.replace(/^(https?|ssh|git):\/\//, "");
  text = text.replace(/^[^@/]+@/, "");
  text = hadScheme ? text.replace(/^([^:/]+):\d+(?=\/|$)/, "$1") : text.replace(":", "/");
  text = text.replace(/\/+$/, "");
  text = text.replace(/\.git$/, "");
  return text;
}

/** @param {string} value @returns {string} */
function normalizePath(value) {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/\.git$/, "");
}

/** @param {string} value @returns {string} */
function resolveReal(value) {
  try {
    return realpathSync(value);
  } catch {
    return value;
  }
}

const urls = readList("PI_MUST_WIN_DISABLED_URLS");
const paths = readList("PI_MUST_WIN_DISABLED_PATHS");

if (urls.length === 0 && paths.length === 0) {
  process.exit(1);
}

const remote = git(["remote", "get-url", "origin"]);
const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
const urlKey = remote === undefined ? undefined : normalizeUrl(remote);
const repoPath = commonDir === undefined ? undefined : resolveReal(normalizePath(commonDir));

if (
  urlKey !== undefined &&
  urls.some((entry) => urlKey === entry || urlKey.startsWith(`${entry}/`))
) {
  process.exit(0);
}
if (repoPath !== undefined && paths.includes(repoPath)) {
  process.exit(0);
}
process.exit(1);
