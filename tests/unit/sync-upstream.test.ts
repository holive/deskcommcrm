import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Executa o próprio passo do workflow com repositórios Git reais, sem rede.
// Só a API de PR é simulada; os merges, conflitos e pushes são reais.
const workflow = readFileSync(".github/workflows/sync-upstream.yml", "utf8");
const run = workflow.split("        run: |\n")[1]!.replace(/^ {10}/gm, "");
let root: string;
let env: NodeJS.ProcessEnv;
let sequence: number;

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function commit(repo: string, file: string, content: string) {
  writeFileSync(join(repo, file), content);
  git(repo, "add", file);
  git(repo, "commit", "-m", `Atualizar ${file}`);
  return git(repo, "rev-parse", "HEAD");
}

function execute() {
  const runner = join(root, `runner-${sequence++}`);
  git(root, "clone", "--quiet", join(root, "origin.git"), runner);
  return spawnSync("bash", ["-euo", "pipefail", "-c", run], {
    cwd: runner,
    env,
    encoding: "utf8",
  });
}

function origin(...args: string[]) {
  return git(join(root, "origin.git"), ...args);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "deskcomm-sync-"));
  sequence = 0;
  env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "Teste",
    GIT_AUTHOR_EMAIL: "teste@example.invalid",
    GIT_COMMITTER_NAME: "Teste",
    GIT_COMMITTER_EMAIL: "teste@example.invalid",
    BASE_BRANCH: "main",
    SYNC_BRANCH: "sync/upstream",
    UPSTREAM_URL: join(root, "upstream"),
    GH_REPO: "teste/fork",
    GITHUB_TOKEN: "",
    GITHUB_STEP_SUMMARY: join(root, "summary"),
    PR_CALLS: join(root, "pr-calls"),
    PR_URL: join(root, "pr-url"),
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
  };
  mkdirSync(join(root, "bin"));
  writeFileSync(
    join(root, "bin", "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$PR_CALLS"
case "$*" in
  'pr list '*) cat "$PR_URL" ;;
  'pr create '*) echo 'https://example.invalid/pull/1' > "$PR_URL"; cat "$PR_URL" ;;
  *) exit 1 ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(env.PR_URL!, "");
  writeFileSync(env.PR_CALLS!, "");
  git(root, "init", "--initial-branch=main", "upstream");
  commit(join(root, "upstream"), "shared", "base\n");
  git(root, "clone", "--quiet", join(root, "upstream"), "fork");
  commit(join(root, "fork"), "meta-only", "customização\n");
  git(root, "clone", "--quiet", "--bare", join(root, "fork"), "origin.git");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("sincronização com upstream", () => {
  it("não escreve nem abre PR quando o upstream já está incorporado", () => {
    const before = origin("show-ref");
    expect(execute().status).toBe(0);
    expect(origin("show-ref")).toBe(before);
    expect(readFileSync(env.PR_CALLS!, "utf8")).toBe("");
  });

  it("preserva commits dos dois lados e não altera a main", () => {
    const main = origin("rev-parse", "main");
    const upstream = commit(join(root, "upstream"), "feature", "nova\n");
    const result = execute();
    expect(result.status, result.stderr).toBe(0);
    expect(origin("rev-parse", "main")).toBe(main);
    expect(origin("merge-base", "--is-ancestor", main, "sync/upstream")).toBe("");
    expect(origin("merge-base", "--is-ancestor", upstream, "sync/upstream")).toBe("");
    expect(origin("show", "sync/upstream:meta-only")).toBe("customização");
    expect(origin("rev-list", "--parents", "-1", "sync/upstream").split(" ")).toHaveLength(3);
    expect(readFileSync(env.PR_CALLS!, "utf8")).toContain("pr create");
  });

  it("reutiliza o PR e preserva alterações manuais ao incorporar novidades", () => {
    commit(join(root, "upstream"), "feature", "primeira\n");
    expect(execute().status).toBe(0);
    git(root, "clone", "--quiet", "--branch", "sync/upstream", join(root, "origin.git"), "manual");
    const manual = commit(join(root, "manual"), "resolucao", "preservar\n");
    git(join(root, "manual"), "push", "origin", "HEAD:sync/upstream");
    const main = commit(join(root, "fork"), "customizacao-nova", "preservar também\n");
    git(join(root, "fork"), "push", join(root, "origin.git"), "main");
    const upstream = commit(join(root, "upstream"), "feature", "segunda\n");
    const result = execute();
    expect(result.status, result.stderr).toBe(0);
    for (const sha of [manual, main, upstream]) {
      expect(origin("merge-base", "--is-ancestor", sha, "sync/upstream")).toBe("");
    }
    expect(execute().status).toBe(0);
    expect(readFileSync(env.PR_CALLS!, "utf8").match(/pr create/g)).toHaveLength(1);
    // Depois do merge do PR, uma execução nova não escreve mais nada.
    git(join(root, "fork"), "fetch", join(root, "origin.git"), "sync/upstream");
    git(join(root, "fork"), "merge", "--no-ff", "--no-edit", "FETCH_HEAD");
    git(join(root, "fork"), "push", join(root, "origin.git"), "main");
    const refs = origin("show-ref");
    const calls = readFileSync(env.PR_CALLS!, "utf8");
    expect(execute().status).toBe(0);
    expect(origin("show-ref")).toBe(refs);
    expect(readFileSync(env.PR_CALLS!, "utf8")).toBe(calls);
  });

  it("para no conflito sem publicar estado parcial ou abrir PR", () => {
    commit(join(root, "fork"), "shared", "nosso\n");
    git(join(root, "fork"), "push", join(root, "origin.git"), "main");
    commit(join(root, "upstream"), "shared", "deles\n");
    const refs = origin("show-ref");
    const result = execute();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::Conflito");
    expect(readFileSync(env.GITHUB_STEP_SUMMARY!, "utf8")).toContain("shared");
    expect(origin("show-ref")).toBe(refs);
    expect(readFileSync(env.PR_CALLS!, "utf8")).toBe("");
  });
});
