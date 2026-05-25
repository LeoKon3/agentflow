#!/usr/bin/env node

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceDir = path.join(packageRoot, "skills", "agentflow");
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const colors = {
  bold: (value) => format(value, "1"),
  dim: (value) => format(value, "2"),
  cyan: (value) => format(value, "36"),
  green: (value) => format(value, "32"),
  yellow: (value) => format(value, "33"),
  red: (value) => format(value, "31"),
};

async function main() {
  const [command] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "install") {
    console.error(colors.red(`Unknown command: ${command}\n`));
    printHelp();
    process.exitCode = 1;
    return;
  }

  await install();
}

function printHelp() {
  printHeader();
  console.log(`${colors.bold("Usage:")}
  agentflow install
  agentflow --help\n`);
  console.log(`${colors.bold("Commands:")}
  install    Install the AgentFlow skill for Claude Code`);
}

async function install() {
  assertSourceExists();
  printHeader();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  process.once("SIGINT", () => {
    rl.close();
    console.log(`\n${colors.yellow("Install cancelled.")}`);
    process.exit(130);
  });

  try {
    await chooseAgentTool(rl);
    const destination = await chooseScope(rl);

    if (!destination) {
      console.log(colors.yellow("Install cancelled."));
      return;
    }

    const confirmed = await confirmInstall(rl, destination);
    if (!confirmed) {
      console.log(colors.yellow("Install cancelled."));
      return;
    }

    await installSkill(rl, destination);
    printSuccess(destination);
  } finally {
    rl.close();
  }
}

function assertSourceExists() {
  const skillFile = path.join(sourceDir, "SKILL.md");
  if (!existsSync(skillFile)) {
    console.error(
      colors.red(`AgentFlow skill source was not found at:\n  ${sourceDir}`),
    );
    process.exit(1);
  }
}

async function chooseAgentTool(rl) {
  while (true) {
    printSection("Target agent");
    printOption("1", "Claude Code", colors.green("supported"));
    printOption("2", "Cancel");

    const answer = normalizeAnswer(await ask(rl, "Choose an option"));

    if (answer === "1" || answer === "claude" || answer === "claude code") {
      return;
    }

    if (answer === "codex" || answer === "codex cli") {
      console.log(
        colors.yellow("Codex CLI support is coming soon. Choose Claude Code or Cancel."),
      );
      continue;
    }

    if (answer === "gemini" || answer === "gemini cli") {
      console.log(
        colors.yellow("Gemini CLI support is coming soon. Choose Claude Code or Cancel."),
      );
      continue;
    }

    if (isCancel(answer) || answer === "2" || answer === "4") {
      console.log(colors.yellow("Install cancelled."));
      process.exit(0);
    }

    console.log(colors.yellow("Please choose 1 or 2."));
  }
}

async function chooseScope(rl) {
  while (true) {
    const projectDestination = path.join(
      process.cwd(),
      ".claude",
      "skills",
      "agentflow",
    );
    const globalDestination = path.join(
      os.homedir(),
      ".claude",
      "skills",
      "agentflow",
    );

    printSection("Install scope");
    printOption(
      "1",
      "Current project",
      colors.dim(path.relative(process.cwd(), projectDestination) || projectDestination),
    );
    printOption("2", "Global", colors.dim(toHomePath(globalDestination)));
    printOption("3", "Cancel");

    const answer = normalizeAnswer(await ask(rl, "Choose an option"));

    if (
      answer === "1" ||
      answer === "project" ||
      answer === "current project"
    ) {
      return projectDestination;
    }

    if (answer === "2" || answer === "global") {
      return globalDestination;
    }

    if (isCancel(answer) || answer === "3") {
      return null;
    }

    console.log(colors.yellow("Please choose 1, 2, or 3."));
  }
}

async function confirmInstall(rl, destination) {
  while (true) {
    printSection("Ready to install");
    console.log(`  ${colors.dim(destination)}`);
    printOption("1", "Install AgentFlow");
    printOption("2", "Cancel");

    const answer = normalizeAnswer(await ask(rl, "Choose an option"));

    if (
      answer === "1" ||
      answer === "install" ||
      answer === "yes" ||
      answer === "y"
    ) {
      return true;
    }

    if (
      isCancel(answer) ||
      answer === "2" ||
      answer === "no" ||
      answer === "n"
    ) {
      return false;
    }

    console.log(colors.yellow("Please choose 1 or 2."));
  }
}

async function installSkill(rl, destination) {
  const parent = path.dirname(destination);
  const tempDestination = uniqueSiblingPath(
    parent,
    ".agentflow-install",
    "tmp",
  );
  const backupDestination = uniqueSiblingPath(
    parent,
    ".agentflow-install",
    "backup",
  );
  let shouldReplace = false;

  await runStep("Preparing install directory", () =>
    fs.mkdir(parent, { recursive: true }),
  );

  if (existsSync(destination)) {
    const stat = await fs.lstat(destination);
    if (!stat.isDirectory()) {
      throw new Error(
        `Destination exists and is not a directory: ${destination}`,
      );
    }

    shouldReplace = await confirmReplace(rl, destination);
    if (!shouldReplace) {
      console.log(colors.yellow("Install cancelled."));
      process.exit(0);
    }
  }

  try {
    await runStep("Copying AgentFlow skill files", () =>
      fs.cp(sourceDir, tempDestination, { recursive: true }),
    );

    if (shouldReplace) {
      await runStep("Replacing existing installation", async () => {
        await fs.rename(destination, backupDestination);
        try {
          await fs.rename(tempDestination, destination);
        } catch (error) {
          await fs.rename(backupDestination, destination).catch(() => {});
          throw error;
        }
        await fs.rm(backupDestination, { recursive: true, force: true });
      });
      return;
    }

    await runStep("Finalizing installation", () =>
      fs.rename(tempDestination, destination),
    );
  } catch (error) {
    await fs
      .rm(tempDestination, { recursive: true, force: true })
      .catch(() => {});
    throw error;
  }
}

async function confirmReplace(rl, destination) {
  while (true) {
    printSection("Existing installation found");
    console.log(`  ${colors.dim(destination)}`);
    console.log(
      colors.yellow("  Replacing it will remove files inside that installed skill directory."),
    );
    printOption("1", "Replace existing installation");
    printOption("2", "Cancel");

    const answer = normalizeAnswer(await ask(rl, "Choose an option"));

    if (
      answer === "1" ||
      answer === "replace" ||
      answer === "yes" ||
      answer === "y"
    ) {
      return true;
    }

    if (
      isCancel(answer) ||
      answer === "2" ||
      answer === "no" ||
      answer === "n"
    ) {
      return false;
    }

    console.log(colors.yellow("Please choose 1 or 2."));
  }
}

function printSuccess(destination) {
  printSection(colors.green("Installed AgentFlow for Claude Code"));
  console.log(`  ${colors.dim(destination)}`);
  console.log(`\n${colors.bold("Next steps")}`);
  console.log(`  ${colors.cyan("1.")} Restart Claude Code if it is already running.`);
  console.log(`  ${colors.cyan("2.")} Run ${colors.bold("/agentflow list")}`);
  console.log(`  ${colors.cyan("3.")} Run ${colors.bold('/agentflow run quick "your task"')}`);
}

function printHeader() {
  console.log(colors.cyan(colors.bold("\nAgentFlow installer")));
  console.log(colors.dim("Role-based workflows for Claude Code"));
}

function printSection(title) {
  console.log(`\n${colors.bold(title)}`);
}

function printOption(number, label, hint = "") {
  const suffix = hint ? `  ${hint}` : "";
  console.log(`  ${colors.cyan(`${number}.`)} ${label}${suffix}`);
}

async function ask(rl, label) {
  return rl.question(`${colors.cyan("?")} ${label}: `);
}

async function runStep(label, action) {
  const spinner = startSpinner(label);
  try {
    const result = await action();
    stopSpinner(spinner, label, "ok");
    return result;
  } catch (error) {
    stopSpinner(spinner, label, "error");
    throw error;
  }
}

function startSpinner(label) {
  if (!process.stdout.isTTY) {
    process.stdout.write(`- ${label}...\n`);
    return null;
  }

  const frames = ["-", "\\", "|", "/"];
  let index = 0;
  process.stdout.write(`${colors.cyan(frames[index])} ${label}...`);
  return setInterval(() => {
    index = (index + 1) % frames.length;
    process.stdout.write(`\r${colors.cyan(frames[index])} ${label}...`);
  }, 80);
}

function stopSpinner(spinner, label, status) {
  if (!process.stdout.isTTY) {
    return;
  }

  clearInterval(spinner);
  const marker = status === "ok" ? colors.green("OK") : colors.red("ERR");
  process.stdout.write(`\r${marker} ${label}\n`);
}

function uniqueSiblingPath(parent, prefix, suffix) {
  return path.join(
    parent,
    `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.${suffix}`,
  );
}

function normalizeAnswer(answer) {
  return answer.trim().toLowerCase();
}

function isCancel(answer) {
  return (
    answer === "" ||
    answer === "q" ||
    answer === "quit" ||
    answer === "c" ||
    answer === "cancel"
  );
}

function toHomePath(targetPath) {
  const home = os.homedir();
  return targetPath.startsWith(home)
    ? `~${targetPath.slice(home.length)}`
    : targetPath;
}

function format(value, code) {
  return useColor ? `[${code}m${value}[0m` : value;
}

main().catch((error) => {
  console.error(`\n${colors.red(error.message)}`);
  process.exit(1);
});
