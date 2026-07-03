import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { spawn } from "child_process";

interface CheckResult {
  name: string;
  command: string;
  status: "passed" | "failed" | "blocked" | "skipped";
  exitCode: number | null;
  durationMs: number;
  output: string;
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const startedAt = new Date();
const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
const logDirectory = path.join(process.cwd(), "logs", "launch-checks");
const logPath = path.join(logDirectory, `${timestamp}.md`);
const args = new Set(process.argv.slice(2));

const skipBuild = args.has("--skip-build");
const skipFirebase = args.has("--skip-firebase");
const allowBlockedFirebase = args.has("--allow-blocked-firebase");

function formatCommand(command: string, commandArgs: string[]) {
  return [command, ...commandArgs].join(" ");
}

function isFirebaseConfigurationBlock(output: string) {
  return (
    output.includes("Firebase Firestore is not configured") ||
    output.includes("Firebase service account file was not found") ||
    output.includes("Firebase Admin SDK configuration is incomplete")
  );
}

function runCommand(name: string, commandArgs: string[]): Promise<CheckResult> {
  const command = npmCommand;
  const formattedCommand = formatCommand(command, commandArgs);
  const started = Date.now();

  return new Promise((resolve) => {
    const childProcess =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", formattedCommand], {
            cwd: process.cwd(),
            env: process.env,
            shell: false,
          })
        : spawn(command, commandArgs, {
            cwd: process.cwd(),
            env: process.env,
            shell: false,
          });
    let output = "";

    childProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    childProcess.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    childProcess.on("close", (exitCode) => {
      const durationMs = Date.now() - started;
      const blocked =
        exitCode !== 0 && allowBlockedFirebase && isFirebaseConfigurationBlock(output);

      resolve({
        name,
        command: formattedCommand,
        status: exitCode === 0 ? "passed" : blocked ? "blocked" : "failed",
        exitCode,
        durationMs,
        output,
      });
    });
  });
}

function writeLog(results: CheckResult[]) {
  mkdirSync(logDirectory, {
    recursive: true,
  });

  const summaryRows = results
    .map(
      (result) =>
        `| ${result.name} | ${result.status} | ${
          result.exitCode ?? "n/a"
        } | ${(result.durationMs / 1000).toFixed(1)}s |`,
    )
    .join("\n");

  const details = results
    .map(
      (result) => `## ${result.name}

- Command: \`${result.command}\`
- Status: ${result.status}
- Exit code: ${result.exitCode ?? "n/a"}
- Duration: ${(result.durationMs / 1000).toFixed(1)}s

\`\`\`text
${result.output.trim() || "(no output)"}
\`\`\`
`,
    )
    .join("\n");

  const content = `# Launch Check Log

- Started: ${startedAt.toISOString()}
- Finished: ${new Date().toISOString()}
- Options: ${Array.from(args).join(" ") || "(none)"}

| Check | Status | Exit code | Duration |
| --- | --- | --- | --- |
${summaryRows}

${details}
`;

  writeFileSync(logPath, content, "utf8");
  console.log(`\nLaunch check log written to ${logPath}`);
}

async function run() {
  const checks: Array<{ name: string; args: string[]; skip?: boolean }> = [
    {
      name: "Lint",
      args: ["run", "lint"],
    },
    {
      name: "Build",
      args: ["run", "build"],
      skip: skipBuild,
    },
    {
      name: "Palacios import dry run",
      args: [
        "run",
        "import:palacios",
        "--",
        "--input",
        "data/palacios-churches.example.json",
        "--dry-run",
      ],
    },
    {
      name: "Firebase data audit",
      args: ["run", "audit:firebase"],
      skip: skipFirebase,
    },
    {
      name: "Workflow test data cleanup dry run",
      args: ["run", "cleanup:test-data", "--", "--dry-run"],
      skip: skipFirebase,
    },
    {
      name: "Demo data cleanup dry run",
      args: ["run", "cleanup:demo-data", "--", "--dry-run"],
      skip: skipFirebase,
    },
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    if (check.skip) {
      results.push({
        name: check.name,
        command: formatCommand(npmCommand, check.args),
        status: "skipped",
        exitCode: null,
        durationMs: 0,
        output: "Skipped by launch-check option.",
      });
      continue;
    }

    console.log(`\n=== ${check.name} ===`);
    results.push(await runCommand(check.name, check.args));
  }

  writeLog(results);

  const failedChecks = results.filter((result) => result.status === "failed");
  const blockedChecks = results.filter((result) => result.status === "blocked");

  if (failedChecks.length > 0) {
    console.error(
      `Launch check failed: ${failedChecks.map((result) => result.name).join(", ")}`,
    );
    process.exit(1);
    return;
  }

  if (blockedChecks.length > 0) {
    console.warn(
      `Launch check completed with blocked Firebase checks: ${blockedChecks
        .map((result) => result.name)
        .join(", ")}`,
    );
  } else {
    console.log("Launch check completed successfully.");
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("Launch check failed unexpectedly.", error);
  process.exit(1);
});
