import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const commands = [
  {
    label: "Qualité du code",
    args: [
      fileURLToPath(new URL("../node_modules/eslint/bin/eslint.js", import.meta.url)),
      "src/domainRules.js",
      "src/main.jsx",
      "src/supabaseClient.js",
      "src/BillingDocumentModal.jsx",
      "src/KennelContractModal.jsx",
      "tests",
      "scripts",
      "vite.config.js",
    ],
  },
  {
    label: "Tests métier",
    args: ["--test"],
  },
  {
    label: "Construction de la PWA",
    args: [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build"],
  },
];

function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, command.args, {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command.label} a échoué avec le code ${code ?? 1}.`));
    });
  });
}

for (const command of commands) {
  console.log(`\n=== ${command.label} ===`);
  try {
    await run(command);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

console.log("\nTous les contrôles sont validés.");
