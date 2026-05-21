import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { mkdirSync, readdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { tmpdir } from 'os';

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

function javaVersion(exe: string): number | null {
  try {
    const r = spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 5000 });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    const m = out.match(/(?:java|openjdk)\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
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

/** Follow HTTP redirects (up to 5 hops) and return the final URL. */
function resolveRedirects(url: string, hops = 0): Promise<string> {
  if (hops > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'sysml-v2-visualizer-vscode' } }, (res) => {
      const { statusCode, headers } = res;
      res.resume();
      if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
        const next = headers.location.startsWith('http')
          ? headers.location
          : new URL(headers.location, url).href;
        resolve(resolveRedirects(next, hops + 1));
      } else if (statusCode === 200) {
        resolve(url);
      } else {
        reject(new Error(`HTTP ${statusCode} from Adoptium API`));
      }
    }).on('error', reject);
  });
}

/** Stream-download `url` to `destPath`, calling `onProgress` with 0–100. */
function downloadFile(url: string, destPath: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'sysml-v2-visualizer-vscode' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading Java`));
        return;
      }
      const total    = parseInt(res.headers['content-length'] ?? '0', 10);
      let   received = 0;
      const out      = fs.createWriteStream(destPath);
      res.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (total > 0) onProgress(Math.round((received / total) * 100));
      });
      res.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
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
    const v = javaVersion(managedExe);
    if (v && v >= MIN_JAVA_VERSION) {
      process.env['SYSML_JAVA_HOME'] = path.dirname(path.dirname(managedExe));
      console.log(`[sysml] Using managed Java ${v} from global storage`);
      return false;
    }
  }

  // 2. System Java is sufficient — let resolveJavaExe() find it as usual
  const systemExe = process.platform === 'win32' ? 'java.exe' : 'java';
  const sysV = javaVersion(systemExe);
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
        progress.report({ message: 'Resolving download URL…' });
        const downloadUrl = await resolveRedirects(apiUrl);

        progress.report({ message: 'Downloading (~200 MB)…' });
        await downloadFile(downloadUrl, tmpFile, (pct) => {
          progress.report({ message: `Downloading… ${pct}%` });
        });

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
