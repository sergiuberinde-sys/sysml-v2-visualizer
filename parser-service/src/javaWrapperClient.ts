import { spawn } from 'child_process';
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

// Resolve the SysML standard library directory.
// Priority: SYSML_STDLIB_PATH env var → bundled sysml-stdlib/ next to this package.
function resolveStdlibPath(): string | null {
  if (process.env['SYSML_STDLIB_PATH']) return process.env['SYSML_STDLIB_PATH'];
  if (existsSync(BUNDLED_STDLIB_PATH)) return BUNDLED_STDLIB_PATH;
  return null;
}

// The JAR requires Java 21+. Probe for a suitable executable in order:
//   1. $SYSML_JAVA_HOME/bin/java[.exe]  (explicit override — highest priority)
//   2. macOS: Homebrew openjdk@21 well-known absolute paths
//   3. Windows: $JAVA_HOME (reliable on Windows — set by every Java installer),
//              then scan common installation roots for a jdk-21.x directory
//   4. 'java' on PATH (last resort)
//
// $JAVA_HOME is skipped on macOS because Maven/Gradle commonly point it at an
// older JDK; on Windows that ambiguity is rare and JAVA_HOME is the standard.
import { readdirSync } from 'fs';
import { execSync } from 'child_process';

/** Score a JDK directory name: higher version = higher score, prefer JDK over JRE. */
function jdkScore(name: string): number {
  const isJre = /jre/i.test(name) && !/jdk/i.test(name);
  const ver   = name.match(/(\d+)/);
  return (ver ? parseInt(ver[1], 10) : 0) - (isJre ? 1000 : 0);
}

function resolveJavaExe(): string {
  const isWin = process.platform === 'win32';
  const exe   = isWin ? 'java.exe' : 'java';

  // 1. Explicit override
  if (process.env['SYSML_JAVA_HOME']) {
    return join(process.env['SYSML_JAVA_HOME'], 'bin', exe);
  }

  if (!isWin) {
    // 2. macOS — Homebrew well-known paths (newest major first)
    for (const candidate of [
      '/opt/homebrew/opt/openjdk@21/bin/java',
      '/opt/homebrew/opt/openjdk@17/bin/java',
      '/opt/homebrew/opt/openjdk/bin/java',
      '/usr/local/opt/openjdk@21/bin/java',
      '/usr/local/opt/openjdk@17/bin/java',
      '/usr/local/opt/openjdk/bin/java',
    ]) {
      if (existsSync(candidate)) {
        console.log(`[sysml-v2-parser-service] Using Java from Homebrew: ${candidate}`);
        return candidate;
      }
    }
  } else {
    // 3a. Windows — JAVA_HOME (set by Oracle, Adoptium, Microsoft, Corretto installers)
    if (process.env['JAVA_HOME']) {
      const candidate = join(process.env['JAVA_HOME'], 'bin', 'java.exe');
      if (existsSync(candidate)) {
        console.log(`[sysml-v2-parser-service] Using Java from JAVA_HOME: ${candidate}`);
        return candidate;
      }
    }

    // 3b. Windows — scan all common installation roots for ANY JDK/JRE
    const pf   = process.env['PROGRAMFILES']       ?? 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)']  ?? 'C:\\Program Files (x86)';
    const ld   = process.env['LOCALAPPDATA']        ?? '';
    const roots: string[] = [
      // Adoptium / Eclipse Temurin
      `${pf}\\Eclipse Adoptium`, `${pf}\\Adoptium`,
      // Microsoft Build of OpenJDK
      `${pf}\\Microsoft`,
      // Oracle JDK / OpenJDK
      `${pf}\\Java`, `${pf86}\\Java`,
      // Amazon Corretto
      `${pf}\\Amazon Corretto`,
      // Azul Zulu
      `${pf}\\Zulu`, `${pf}\\Azul`,
      // BellSoft Liberica
      `${pf}\\BellSoft`,
      // GraalVM
      `${pf}\\GraalVM`,
      // Generic OpenJDK
      `${pf}\\OpenJDK`,
      // Scoop / user-level installs
      ...(ld ? [`${ld}\\Programs`] : []),
    ];

    const found: { candidate: string; score: number }[] = [];
    for (const root of roots) {
      if (!existsSync(root)) continue;
      let entries: string[] = [];
      try { entries = readdirSync(root); } catch { continue; }
      for (const entry of entries) {
        const candidate = join(root, entry, 'bin', 'java.exe');
        if (existsSync(candidate)) {
          found.push({ candidate, score: jdkScore(entry) });
        }
      }
    }
    if (found.length > 0) {
      found.sort((a, b) => b.score - a.score);
      console.log(`[sysml-v2-parser-service] Using Java from directory scan: ${found[0].candidate}`);
      return found[0].candidate;
    }

    // 3c. Windows — ask `where.exe` to locate java on PATH
    try {
      const result = execSync('where java.exe', { encoding: 'utf8', timeout: 3000 }).trim();
      const first  = result.split('\n')[0]?.trim();
      if (first && existsSync(first)) {
        console.log(`[sysml-v2-parser-service] Using Java from where.exe: ${first}`);
        return first;
      }
    } catch { /* where.exe failed — fall through */ }
  }

  // 4. Last resort — works if java is on PATH (e.g. VS Code launched from terminal)
  return exe;
}

export function resolveJarPath(): string {
  return process.env['SYSML_PARSER_JAR'] ?? DEFAULT_JAR;
}

/** Returns the Java major version (e.g. 21), or null if it cannot be determined. */
function getJavaMajorVersion(javaExe: string): number | null {
  for (const args of [['--version'], ['-version']]) {
    try {
      // '--version' prints to stdout; '-version' to stderr — capture both.
      const out = execSync(`"${javaExe}" ${args.join(' ')}`, {
        encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const m = out.match(/(?:java|openjdk)\s+(\d+)/i);
      if (m) return parseInt(m[1], 10);
    } catch (e) {
      // execSync throws when the process exits non-zero; stderr is in e.stderr
      const combined = [(e as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '', String(e)].join(' ');
      const m = combined.match(/(?:java|openjdk)\s+version\s+"?(\d+)/i);
      if (m) return parseInt(m[1], 10);
    }
  }
  return null;
}

// ── Persistent JVM process ────────────────────────────────────────────────────

/**
 * Manages a single long-lived JVM process running in --server mode.
 * stdlib is loaded once on startup; subsequent parses complete in <1s.
 *
 * Protocol (line-delimited JSON over stdin/stdout):
 *   → {"id":"<hex>","primaryPath":"<path>","contextPaths":["<path>",...]}
 *   ← {"id":"<hex>","success":<bool>,"diagnostics":[...],"model":[...]}
 */
class JavaPersistentProcess {
  private proc: ReturnType<typeof spawn> | null = null;
  private ready = false;
  private startingPromise: Promise<void> | null = null;
  private lineBuffer = '';

  // At most one request is in-flight at a time; extras chain via this mutex.
  private requestMutex: Promise<void> = Promise.resolve();

  // Resolve/reject for the single in-flight request.
  private pendingResolve: ((line: string) => void) | null = null;
  private pendingReject:  ((err: Error)  => void) | null = null;

  constructor(
    private readonly jarPath: string,
    private readonly javaExe: string,
  ) {}

  /** Returns true while the process is running, including during startup. */
  isAlive(): boolean {
    return this.proc !== null;
  }

  /** Ensure the JVM is running and ready. Safe to call concurrently. */
  ensureStarted(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.startingPromise) return this.startingPromise;
    this.startingPromise = this.checkVersionThenStart();
    return this.startingPromise;
  }

  private checkVersionThenStart(): Promise<void> {
    const version = getJavaMajorVersion(this.javaExe);
    if (version !== null && version < 17) {
      return Promise.reject(new Error(
        `Java ${version} detected but Java 17 or 21 is required. ` +
        `Please install Java 21 from https://adoptium.net and restart VS Code.`
      ));
    }
    return this.doStart();
  }

  private doStart(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stdlibPath = resolveStdlibPath();
      const env = stdlibPath
        ? { ...process.env, SYSML_STDLIB_PATH: stdlibPath } as NodeJS.ProcessEnv
        : process.env as NodeJS.ProcessEnv;

      const proc = spawn(this.javaExe, ['-jar', this.jarPath, '--server'], { env });
      this.proc = proc;

      // Stdout before "ready" arrives is handled by the early listener below.
      // After "ready", attachResponseHandler() takes over.
      let earlyBuffer = '';
      let settled = false;

      // 5-minute deadline covers worst-case stdlib loading (~2.5 min measured)
      const READY_TIMEOUT_MS = 5 * 60 * 1000;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill();
        this.reset();
        reject(new Error('JVM server startup timed out (stdlib loading exceeded 5 minutes)'));
      }, READY_TIMEOUT_MS);

      const onEarlyData = (chunk: Buffer) => {
        earlyBuffer += chunk.toString('utf8');
        const lines = earlyBuffer.split('\n');
        earlyBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || settled) continue;
          try {
            const msg = JSON.parse(trimmed) as { ready?: boolean; error?: string };
            if ('ready' in msg) {
              clearTimeout(timer);
              settled = true;
              proc.stdout!.off('data', onEarlyData);
              if (msg.ready === true) {
                this.ready = true;
                this.attachResponseHandler();
                resolve();
              } else {
                proc.kill();
                this.reset();
                reject(new Error(`JVM server failed to start: ${msg.error ?? 'unknown'}`));
              }
            }
          } catch { /* not JSON — progress line on stderr usually, ignore */ }
        }
      };

      // Capture stderr so we can include it in error messages.
      let stderrCapture = '';
      proc.stdout!.on('data', onEarlyData);
      proc.stderr!.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stderrCapture += text;
        process.stderr.write(text);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (!settled) { settled = true; reject(err); }
        this.drainPending(err instanceof Error ? err : new Error(String(err)));
        this.reset();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          const detail = stderrCapture.trim().split('\n').slice(0, 3).join(' | ');
          const hint = detail.includes('UnsupportedClassVersionError') || detail.includes('class file version')
            ? ' (Java version too old — install Java 17 or 21)'
            : detail ? ` — ${detail}` : '';
          reject(new Error(`JVM server exited before ready (code ${code})${hint}`));
        }
        this.drainPending(new Error(`JVM server process exited (code ${code})`));
        this.reset();
      });
    });
  }

  /** Attach the response handler once the JVM signals ready. */
  private attachResponseHandler() {
    this.proc!.stdout!.on('data', (chunk: Buffer) => {
      this.lineBuffer += chunk.toString('utf8');
      const lines = this.lineBuffer.split('\n');
      this.lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const resolve = this.pendingResolve;
        if (resolve) {
          this.pendingResolve = null;
          this.pendingReject  = null;
          resolve(trimmed);
        }
      }
    });
  }

  /** Reject any in-flight request (called when the process dies). */
  private drainPending(err: Error) {
    const rej = this.pendingReject;
    this.pendingResolve = null;
    this.pendingReject  = null;
    if (rej) rej(err);
  }

  private reset() {
    this.proc = null;
    this.ready = false;
    this.startingPromise = null;
    this.lineBuffer = '';
  }

  /**
   * Send a one-line JSON request and return the one-line JSON response.
   * Calls are serialized — only one is in-flight at a time.
   */
  sendRequest(requestLine: string): Promise<string> {
    const next = this.requestMutex.then(() => this.doSend(requestLine));
    this.requestMutex = next.then(() => {}, () => {});
    return next;
  }

  private doSend(requestLine: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // 60 s is generous for a single parse without stdlib loading overhead
      const RESPONSE_TIMEOUT_MS = 60_000;
      const timer = setTimeout(() => {
        this.pendingResolve = null;
        this.pendingReject  = null;
        reject(new Error('JVM server request timed out after 60s'));
      }, RESPONSE_TIMEOUT_MS);

      this.pendingResolve = (line: string) => { clearTimeout(timer); resolve(line); };
      this.pendingReject  = (err: Error)  => { clearTimeout(timer); reject(err); };

      try {
        this.proc!.stdin!.write(requestLine + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pendingResolve = null;
        this.pendingReject  = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

// One persistent JVM per JAR path, shared across JavaWrapperClient instances.
const persistentJVMs = new Map<string, JavaPersistentProcess>();

function getPersistentJVM(jarPath: string, javaExe: string): JavaPersistentProcess {
  let jvm = persistentJVMs.get(jarPath);
  if (!jvm || !jvm.isAlive()) {
    jvm = new JavaPersistentProcess(jarPath, javaExe);
    persistentJVMs.set(jarPath, jvm);
  }
  return jvm;
}

// ── JavaWrapperClient ─────────────────────────────────────────────────────────

export class JavaWrapperClient implements OfficialBackendClient {
  private readonly jarPath: string;
  private readonly javaExe: string;

  constructor(jarPath: string) {
    this.jarPath = jarPath;
    this.javaExe = resolveJavaExe();

    // Eagerly warm up the persistent JVM so stdlib loading happens in the
    // background while the user is still navigating the UI.
    if (existsSync(jarPath)) {
      console.log('[sysml-v2-parser-service] Starting persistent JVM (stdlib warmup)...');
      getPersistentJVM(jarPath, this.javaExe)
        .ensureStarted()
        .then(() => console.log('[sysml-v2-parser-service] JVM ready.'))
        .catch((err: unknown) => {
          console.error('[sysml-v2-parser-service] JVM warmup failed:', err);
        });
    }
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

      const contextPaths: string[] = [];
      for (const ctx of context) {
        const safeName = basename(ctx.name).replace(/[^a-zA-Z0-9_\-.]/g, '_');
        const ctxPath  = join(tmpDir, safeName);
        writeFileSync(ctxPath, ctx.text, 'utf8');
        contextPaths.push(ctxPath);
      }

      const jvm = getPersistentJVM(this.jarPath, this.javaExe);
      await jvm.ensureStarted();

      const reqId = randomBytes(8).toString('hex');
      const requestLine = JSON.stringify({ id: reqId, primaryPath: tmpFile, contextPaths });
      const responseLine = await jvm.sendRequest(requestLine);

      try {
        const raw = JSON.parse(responseLine) as Record<string, unknown>;
        delete raw['id'];
        return raw as unknown as SysMLV2ParseResult;
      } catch {
        return wrapperError(
          `Official SysML parser wrapper failed: non-JSON response: ${responseLine.slice(0, 300)}`
        );
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return wrapperError(`Official SysML parser wrapper failed: ${msg}`);
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
    }
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function wrapperError(message: string): SysMLV2ParseResult {
  return {
    success: false,
    diagnostics: [{ message, severity: 'error' }],
    error: message,
  };
}
