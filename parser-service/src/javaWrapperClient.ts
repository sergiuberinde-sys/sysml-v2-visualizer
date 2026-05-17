import { spawn, execSync } from 'child_process';
import { existsSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// When compiled, this file lives at parser-service/dist/javaWrapperClient.js.
// One level up is parser-service/; the bundled SysML standard library lives there.
const BUNDLED_STDLIB_PATH = join(__dirname, '..', 'sysml-stdlib');

import type { OfficialBackendClient } from './officialBackendClient';
import type { SysMLV2ParseResult } from './types';

interface ContextFile { name: string; text: string }

// When compiled, this file lives at parser-service/dist/javaWrapperClient.js.
// Two levels up is the project root; from there the Java module is predictable.
const DEFAULT_JAR = join(
  __dirname, '..', '..', 'java-parser-wrapper', 'target', 'sysml-parse-cli.jar'
);

// Generous timeout: JVM cold start + loading 94 stdlib files + user files can take ~30-60 s
const PARSE_TIMEOUT_MS = 120_000;

// Resolve the SysML standard library directory.
// Priority: SYSML_STDLIB_PATH env var → bundled sysml-stdlib/ next to this package.
function resolveStdlibPath(): string | null {
  if (process.env['SYSML_STDLIB_PATH']) return process.env['SYSML_STDLIB_PATH'];
  if (existsSync(BUNDLED_STDLIB_PATH)) return BUNDLED_STDLIB_PATH;
  return null;
}

// The JAR requires Java 21+. Probe for a suitable executable in order:
//   1. $SYSML_JAVA_HOME/bin/java  (explicit Java override, separate from $JAVA_HOME)
//   2. Homebrew openjdk@21 well-known paths (most reliable on macOS with Homebrew)
//   3. 'java' on PATH (last resort — may be too old, will fail at runtime)
//
// $JAVA_HOME is intentionally NOT used here — it is commonly set to an older JDK
// by build tools (Maven, Gradle) and the shell profile; trusting it would silently
// select the wrong version when the system default is Java 17 and the user has
// Java 21 installed via Homebrew.
function resolveJavaExe(): string {
  if (process.env['SYSML_JAVA_HOME']) return join(process.env['SYSML_JAVA_HOME'], 'bin', 'java');

  // Homebrew default paths (arm64 M-series / x86_64 Intel)
  for (const candidate of [
    '/opt/homebrew/opt/openjdk@21/bin/java',
    '/usr/local/opt/openjdk@21/bin/java',
  ]) {
    if (existsSync(candidate)) {
      console.log(`[sysml-v2-parser-service] Using Java 21 from Homebrew: ${candidate}`);
      return candidate;
    }
  }

  return 'java';
}

export function resolveJarPath(): string {
  return process.env['SYSML_PARSER_JAR'] ?? DEFAULT_JAR;
}

export class JavaWrapperClient implements OfficialBackendClient {
  private readonly jarPath: string;
  private readonly javaExe: string;

  constructor(jarPath: string) {
    this.jarPath = jarPath;
    this.javaExe = resolveJavaExe();
  }

  async health(): Promise<boolean> {
    return existsSync(this.jarPath);
  }

  async parse(text: string, context: ContextFile[] = []): Promise<SysMLV2ParseResult> {
    if (!existsSync(this.jarPath)) {
      return wrapperError(
        `Official SysML parser wrapper failed: JAR not found at ${this.jarPath}. ` +
        'Run: cd java-parser-wrapper && mvn clean package'
      );
    }

    const tmpDir  = mkdtempSync(join(tmpdir(), 'sysml-'));
    const tmpFile = join(tmpDir, 'primary.sysml');

    try {
      writeFileSync(tmpFile, text, 'utf8');

      // Write each context file into the same temp directory using its sanitized basename
      const contextPaths: string[] = [];
      for (const ctx of context) {
        const safeName = basename(ctx.name).replace(/[^a-zA-Z0-9_\-.]/g, '_');
        const ctxPath  = join(tmpDir, safeName);
        writeFileSync(ctxPath, ctx.text, 'utf8');
        contextPaths.push(ctxPath);
      }

      const stdlibPath = resolveStdlibPath();
      const javaEnv = stdlibPath
        ? { ...process.env, SYSML_STDLIB_PATH: stdlibPath }
        : process.env;

      const { stdout, stderr, code } = await runProcess(
        this.javaExe,
        ['-jar', this.jarPath, tmpFile, ...contextPaths],
        PARSE_TIMEOUT_MS,
        javaEnv as NodeJS.ProcessEnv,
      );

      // exit 0 = success (no errors), exit 1 = parse errors — both emit valid JSON on stdout
      if (code === 0 || code === 1) {
        try {
          return JSON.parse(stdout) as SysMLV2ParseResult;
        } catch {
          return wrapperError(
            `Official SysML parser wrapper failed: non-JSON output: ${stdout.slice(0, 300)}`
          );
        }
      }

      // exit 2 = invocation error — wrapper may still have emitted a JSON error object
      const raw = stdout.trim();
      if (raw.startsWith('{')) {
        try {
          return JSON.parse(raw) as SysMLV2ParseResult;
        } catch { /* fall through */ }
      }

      const detail = raw || stderr.trim() || `exit code ${code}`;
      return wrapperError(`Official SysML parser wrapper failed: ${detail}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return wrapperError(`Official SysML parser wrapper failed: ${msg}`);
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function runProcess(
  exe: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, env ? { env } : undefined);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Java wrapper timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function wrapperError(message: string): SysMLV2ParseResult {
  return {
    success: false,
    diagnostics: [{ message, severity: 'error' }],
    error: message,
  };
}
