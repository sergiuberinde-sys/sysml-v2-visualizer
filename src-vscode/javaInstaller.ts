import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirSync, readdirSync } from 'fs';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

const JAVA_VERSION = 21;
const MIN_JAVA_VERSION = 17;

function adoptiumTarget(): { os: string; arch: string; ext: 'tar.gz' | 'zip' } | null {
  const osMap: Record<string, string>   = { darwin: 'mac', win32: 'windows', linux: 'linux' };
  const archMap: Record<string, string> = { x64: 'x64', arm64: 'aarch64' };
  const adoptOs   = osMap[process.platform];
  const adoptArch = archMap[process.arch];
  if (!adoptOs || !adoptArch) return null;
  return { os: adoptOs, arch: adoptArch, ext: process.platform === 'win32' ? 'zip' : 'tar.gz' };
}

async function javaVersion(exe: string): Promise<number | null> {
  try {
    const { stdout, stderr } = await execAsync(`"${exe}" --version`, { timeout: 5000 });
    const out = (stdout ?? '') + (stderr ?? '');
    const m = out.match(/(?:java|openjdk)\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  } catch (e) {
    const out = [(e as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '', String(e)].join(' ');
    const m = out.match(/(?:java|openjdk)\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }
}

/** Walk directory tree (depth ≤ 4) to find bin/java[.exe]. */
function findJavaExe(dir: string, depth = 0): string | null {
  if (depth > 4 || !fs.existsSync(dir)) return null;
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidate = path.join(dir, 'bin', exe);
  if (fs.existsSync(candidate)) return candidate;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const hit = findJavaExe(path.join(dir, entry.name), depth + 1);
      if (hit) return hit;
    }
  } catch { /* permission denied — skip */ }
  return null;
}

/**
 * Download `url` to `destPath` with progress reporting.
 * Primary: Node.js fetch (fast, progress-aware).
 * Fallback: system curl / PowerShell — these already respect corporate proxy
 *           settings and CA certificates configured by IT.
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress: (pct: number) => void,
  onFallback: () => void,
): Promise<void> {
  try {
    await fetchToFile(url, destPath, onProgress);
  } catch (fetchErr) {
    console.log(`[sysml] fetch download failed (${fetchErr}) — retrying with system curl`);
    onFallback();
    await downloadWithSystemTool(url, destPath);
  }
}

/** Stream download via Node.js fetch with per-chunk progress. */
async function fetchToFile(url: string, destPath: string, onProgress: (pct: number) => void): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': 'sysml-v2-visualizer-vscode' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Adoptium`);

  const total    = parseInt(res.headers.get('content-length') ?? '0', 10);
  let   received = 0;
  const out      = fs.createWriteStream(destPath);

  const reader = res.body!.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise<void>((resolve, reject) => {
        out.write(Buffer.from(value), err => (err ? reject(err) : resolve()));
      });
      received += value.length;
      if (total > 0) onProgress(Math.round((received / total) * 100));
    }
    await new Promise<void>((resolve, reject) =>
      out.end((err: Error | null) => (err ? reject(err) : resolve())),
    );
  } catch (err) {
    out.destroy();
    throw err;
  }
}

/**
 * Download via the OS-level tool (async — does not block the event loop).
 * curl  — macOS, Linux, Windows 10 1803+ (built-in); uses libcurl / WinHTTP.
 * PowerShell WebClient — Windows fallback; uses .NET HttpClient / WinHTTP.
 * Both honour the system proxy and trusted CA store configured by IT.
 */
async function downloadWithSystemTool(url: string, destPath: string): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execAsync(`curl.exe -L -f -s -o "${destPath}" "${url}"`, { timeout: 600_000 });
    } catch {
      await execAsync(
        `powershell -Command "& { $ProgressPreference='SilentlyContinue'; (New-Object System.Net.WebClient).DownloadFile('${url}','${destPath}') }"`,
        { timeout: 600_000 },
      );
    }
  } else {
    await execAsync(`curl -L -f -s -o "${destPath}" "${url}"`, { timeout: 600_000 });
  }
}

/** Extract JDK archive to `extractDir` and return the Java home path. */
async function extractJdk(archivePath: string, extractDir: string, ext: 'tar.gz' | 'zip'): Promise<string> {
  mkdirSync(extractDir, { recursive: true });

  if (ext === 'tar.gz') {
    // --strip-components=1 drops the top-level jdk-X.Y.Z+N directory
    execSync(`tar xzf "${archivePath}" -C "${extractDir}" --strip-components=1`, { timeout: 120_000 });
  } else {
    // Windows: extract as-is — findJavaExe handles the nested jdk-X.Y.Z+N/ structure
    execSync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`,
      { timeout: 120_000 },
    );
  }

  // Locate bin/java, which may be nested under Contents/Home on macOS
  const javaExe = findJavaExe(extractDir);
  if (!javaExe) throw new Error('java executable not found after extraction');
  return path.dirname(path.dirname(javaExe)); // parent of bin/
}

/**
 * Ensure Java ≥ 17 is available, downloading Temurin 21 from Adoptium if needed.
 *
 * Sets process.env.SYSML_JAVA_HOME when a managed copy is used so that
 * JavaWrapperClient.resolveJavaExe() picks it up at the highest priority.
 *
 * Fast-path (Java already present): completes in < 100 ms with no UI.
 * Download path: shows a VS Code progress notification (~200 MB).
 *
 * Returns true when Java was freshly downloaded (caller should show JVM warmup progress).
 */
export async function ensureJava(globalStoragePath: string): Promise<boolean> {
  const managedDir = path.join(globalStoragePath, `java-${JAVA_VERSION}`);

  // 1. Already-managed Java downloaded by a previous session
  const managedExe = findJavaExe(managedDir);
  if (managedExe) {
    const v = await javaVersion(managedExe);
    if (v && v >= MIN_JAVA_VERSION) {
      process.env['SYSML_JAVA_HOME'] = path.dirname(path.dirname(managedExe));
      console.log(`[sysml] Using managed Java ${v} from global storage`);
      return false;
    }
  }

  // 2a. macOS / Linux: check well-known installation paths before PATH lookup.
  //     VS Code launched from the Dock won't have /opt/homebrew/bin in PATH,
  //     but Homebrew Java is still usable via its absolute path.
  if (process.platform !== 'win32') {
    const candidates = [
      '/opt/homebrew/opt/openjdk@21/bin/java',
      '/opt/homebrew/opt/openjdk@17/bin/java',
      '/opt/homebrew/opt/openjdk/bin/java',
      '/usr/local/opt/openjdk@21/bin/java',
      '/usr/local/opt/openjdk@17/bin/java',
      '/usr/local/opt/openjdk/bin/java',
      '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
      '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
      '/usr/bin/java',
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const v = await javaVersion(candidate);
      if (v && v >= MIN_JAVA_VERSION) {
        console.log(`[sysml] Java ${v} found at ${candidate} — no download needed`);
        return false;
      }
    }
  }

  // 2b. System Java is on PATH — let resolveJavaExe() find it as usual
  const systemExe = process.platform === 'win32' ? 'java.exe' : 'java';
  const sysV = await javaVersion(systemExe);
  if (sysV && sysV >= MIN_JAVA_VERSION) {
    console.log(`[sysml] System Java ${sysV} found — no download needed`);
    return false;
  }

  // 3. Download Temurin 21 from Adoptium
  const target = adoptiumTarget();
  if (!target) {
    void vscode.window.showErrorMessage(
      `SysML v2 Visualizer: Java ${MIN_JAVA_VERSION}+ is required but cannot be auto-installed on ` +
      `${process.platform}/${process.arch}. Please install Java from https://adoptium.net`,
    );
    return false;
  }

  const apiUrl  = `https://api.adoptium.net/v3/binary/latest/${JAVA_VERSION}/ga/${target.os}/${target.arch}/jdk/hotspot/normal/eclipse`;
  const tmpFile = path.join(tmpdir(), `sysml-jdk-${Date.now()}.${target.ext}`);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title:    `SysML v2 Visualizer: Installing Java ${JAVA_VERSION}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Downloading (~200 MB)…' });
        await downloadFile(
          apiUrl, tmpFile,
          (pct) => progress.report({ message: `Downloading… ${pct}%` }),
          ()    => progress.report({ message: 'Downloading via system curl…' }),
        );

        progress.report({ message: 'Extracting…' });
        try { fs.rmSync(managedDir, { recursive: true, force: true }); } catch { /* ignore */ }
        const javaHome = await extractJdk(tmpFile, managedDir, target.ext);
        process.env['SYSML_JAVA_HOME'] = javaHome;
      },
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(
      `SysML v2 Visualizer: Failed to auto-install Java: ${msg}. ` +
      `Please install Java 17 or 21 manually from https://adoptium.net`,
    );
    return false;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* not created or already removed */ }
  }
}
