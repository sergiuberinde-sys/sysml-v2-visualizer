package com.sysmlvisualizer.parser;

import com.google.inject.Injector;
import org.eclipse.emf.common.util.EList;
import org.eclipse.emf.common.util.URI;
import org.eclipse.emf.ecore.EObject;
import org.eclipse.emf.ecore.EPackage;
import org.eclipse.emf.ecore.EReference;
import org.eclipse.emf.ecore.EStructuralFeature;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.emf.ecore.util.EcoreUtil;
import org.eclipse.xtext.resource.XtextResourceSet;
import org.omg.kerml.xtext.KerMLStandaloneSetup;
import org.omg.kerml.xtext.xmi.KerMLxStandaloneSetup;
import org.omg.sysml.interactive.SysMLInteractive;
import org.omg.sysml.lang.sysml.SysMLPackage;
import org.omg.sysml.xtext.SysMLStandaloneSetup;
import org.omg.sysml.xtext.xmi.SysMLxStandaloneSetup;

import org.eclipse.xtext.nodemodel.ICompositeNode;
import org.eclipse.xtext.nodemodel.util.NodeModelUtils;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;

/**
 * Headless CLI that delegates to the official SysML v2 Pilot Implementation
 * Xtext parser and prints a JSON report to stdout.
 *
 * Stdout contract: always exactly one JSON object, nothing else.
 * Stderr: stack traces and JVM diagnostics only.
 *
 * Usage (normal):  java -jar sysml-parse-cli.jar <file.sysml>
 * Usage (debug):   java -jar sysml-parse-cli.jar --debug <file.sysml>
 * Usage (server):  java -jar sysml-parse-cli.jar --server
 *   Loads stdlib once, then reads one-line JSON requests from stdin and writes
 *   one-line JSON responses to stdout.  Amortizes the 2.5-min stdlib startup.
 *   Request:  {"id":"<str>","primaryPath":"<path>","contextPaths":["<path>",...]}
 *   Response: {"id":"<str>","success":<bool>,"diagnostics":[...],"model":[...]}
 *
 * Exit codes:
 *   0  parsed without errors (warnings may be present)
 *   1  parse errors present
 *   2  invocation error (wrong args, file missing, JVM setup failure)
 */
public class SysmlParseCli {

    public static void main(String[] args) {
        boolean server = args.length > 0 && "--server".equals(args[0]);
        boolean debug  = args.length > 0 && "--debug".equals(args[0]);
        String[] rest  = (server || debug) ? Arrays.copyOfRange(args, 1, args.length) : args;

        try {
            if (server) {
                runServer();
            } else if (debug) {
                runDebug(rest);
            } else {
                run(rest);
            }
        } catch (Throwable t) {
            t.printStackTrace(System.err);
            emit(wrapperErrorJson(t));
            System.exit(2);
        }
    }

    // ── Normal mode ───────────────────────────────────────────────────────────

    private static void run(String[] args) {
        if (args.length < 1) {
            emit(errorJson("Usage: java -jar sysml-parse-cli.jar <primary.sysml> [ctx1.sysml ...]"));
            System.exit(2);
        }

        File primaryFile = new File(args[0]);
        if (!primaryFile.exists()) {
            emit(errorJson("File not found: " + args[0]));
            System.exit(2);
        }

        // SysMLInteractive.createInstance() does the same Xtext/EMF setup as our
        // old initSysML() but also installs a ResourceDescriptionsData adapter on its
        // ResourceSet.  That adapter acts as an in-memory Xtext index so the global
        // scope provider can find elements across all loaded resources — without it,
        // qualified-name cross-references like "ScalarValues::Boolean" fail even when
        // the referent file is in the ResourceSet.
        //
        // The Pilot Implementation prints progress lines to System.out while loading
        // resources.  We redirect stdout to stderr for the duration so our JSON-only
        // stdout contract is not broken.
        PrintStream realOut = System.out;
        SysMLInteractive sysml;
        boolean hasStdlib = false;
        try {
            System.setOut(System.err);
            sysml = SysMLInteractive.createInstance();

            // Load standard library if SYSML_STDLIB_PATH is set.
            // loadLibrary() loads Kernel Libraries (.kerml), then Systems Library
            // and Domain Libraries (.sysml) into the resource set so that stdlib
            // imports like "ScalarValues::Boolean" resolve.
            String stdlibPath = System.getenv("SYSML_STDLIB_PATH");
            if (stdlibPath != null && !stdlibPath.isBlank()) {
                sysml.loadLibrary(stdlibPath);
                hasStdlib = true;
            }

            // Load workspace context files so project-specific qualified-name imports
            // (e.g. "private import AcpdCdd_SysMLv2::Types::*") resolve.
            for (int i = 1; i < args.length; i++) {
                File ctx = new File(args[i]);
                if (ctx.exists()) {
                    sysml.getResourceSet()
                         .getResource(URI.createFileURI(ctx.getAbsolutePath()), true)
                         .getContents();
                }
            }
            // Trigger cross-reference resolution for all loaded resources so the
            // ResourceDescriptionsData index is fully populated before the primary
            // file's lazy links fire.
            EcoreUtil.resolveAll(sysml.getResourceSet());
        } finally {
            System.setOut(realOut);
        }

        try {
            // Load primary file into the same resource set (already has stdlib + context).
            Resource resource = sysml.getResourceSet().getResource(
                    URI.createFileURI(primaryFile.getAbsolutePath()), true);

            // Resolve primary file's cross-refs using the fully-populated index.
            EcoreUtil.resolveAll(sysml.getResourceSet());

            // Build the model tree (all proxies resolved; traversal just reads values).
            Set<EObject> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            List<Node> model = new ArrayList<>();
            for (EObject root : resource.getContents()) {
                model.add(buildNode(root, visited));
            }

            // Filter diagnostics: suppress residual "Couldn't resolve reference" errors
            // when stdlib or workspace context files were provided — remaining unresolved
            // refs are for external packages not available in this parse session.
            boolean hasContext = hasStdlib || (args.length > 1);
            List<Diag> diags = new ArrayList<>();
            List<Resource.Diagnostic> trueErrors = new ArrayList<>();
            for (Resource.Diagnostic d : resource.getErrors()) {
                String msg = d.getMessage();
                if (hasContext && msg != null && msg.startsWith("Couldn't resolve reference to")) {
                    // suppress
                } else {
                    diags.add(new Diag("error", msg, d.getLine(), d.getColumn()));
                    trueErrors.add(d);
                }
            }
            for (Resource.Diagnostic d : resource.getWarnings()) {
                diags.add(new Diag("warning", d.getMessage(), d.getLine(), d.getColumn()));
            }

            boolean success = trueErrors.isEmpty();
            emit(toJson(success, diags, model));
            System.exit(success ? 0 : 1);

        } catch (Exception e) {
            e.printStackTrace(System.err);
            emit(wrapperErrorJson(e));
            System.exit(2);
        }
    }

    // ── Server mode ───────────────────────────────────────────────────────────

    /**
     * Long-lived server: loads stdlib once, then processes one-line JSON requests
     * from stdin and writes one-line JSON responses to stdout.
     *
     * Startup handshake (written to stdout before accepting requests):
     *   {"ready":true}          — stdlib loaded OK (or skipped)
     *   {"ready":false,"error":"<msg>"}  — startup failed
     */
    private static void runServer() {
        PrintStream realOut = System.out;
        SysMLInteractive sysml;

        try {
            System.setOut(System.err);
            sysml = SysMLInteractive.createInstance();

            String stdlibPath = System.getenv("SYSML_STDLIB_PATH");
            if (stdlibPath != null && !stdlibPath.isBlank()) {
                System.err.println("[server] Loading SysML stdlib from: " + stdlibPath);
                sysml.loadLibrary(stdlibPath);
                System.err.println("[server] Stdlib loaded — ready.");
            }
        } catch (Throwable t) {
            System.setOut(realOut);
            t.printStackTrace(System.err);
            realOut.println("{\"ready\":false,\"error\":" + jsonStr(t.getMessage()) + "}");
            realOut.flush();
            System.exit(2);
            return;
        } finally {
            System.setOut(realOut);
        }

        realOut.println("{\"ready\":true}");
        realOut.flush();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                String reqId = null;
                try {
                    reqId = extractJsonString(line, "id");
                    String primaryPath = extractJsonString(line, "primaryPath");
                    List<String> ctxPaths = extractJsonStringArray(line, "contextPaths");

                    if (primaryPath == null) throw new IllegalArgumentException("Missing primaryPath");

                    String result  = executeForServer(sysml, primaryPath, ctxPaths);
                    String compact = compactJson(result);
                    // Prepend the request id into the response JSON object
                    String response = "{\"id\":" + jsonStr(reqId) + "," + compact.substring(1);
                    realOut.println(response);
                } catch (Throwable t) {
                    String errMsg = t.getMessage() != null ? t.getMessage() : t.getClass().getName();
                    realOut.println("{\"id\":" + jsonStr(reqId) +
                            ",\"success\":false,\"diagnostics\":[{\"message\":" + jsonStr("Server error: " + errMsg) +
                            ",\"severity\":\"error\",\"line\":0,\"column\":0}],\"model\":[]}");
                }
                realOut.flush();
            }
        } catch (Exception e) {
            e.printStackTrace(System.err);
            System.exit(2);
        }
    }

    /**
     * Execute a single parse request against a shared SysMLInteractive instance.
     * Returns the toJson() payload (may be multi-line; caller compacts it).
     *
     * Important: we do NOT call EcoreUtil.resolveAll(resourceSet) here — that
     * traverses all 94 stdlib resources and can trigger NPEs in the Pilot
     * Implementation's derived-feature adapters.  Instead we resolve only the
     * primary resource, which is enough because cross-references to stdlib types
     * are extracted from the Xtext parse-tree via NodeModelUtils when the proxy
     * is still unresolved (see crossRefName()).
     */
    private static String executeForServer(SysMLInteractive sysml,
                                           String primaryPath,
                                           List<String> contextPaths) {
        File primaryFile = new File(primaryPath);
        if (!primaryFile.exists()) return errorJson("File not found: " + primaryPath);

        PrintStream realOut = System.out;
        boolean hasContext = false;

        try {
            System.setOut(System.err);

            // Unload primary file from the resource set so edits are reflected on reparse.
            URI primaryUri = URI.createFileURI(primaryFile.getAbsolutePath());
            Resource stale = sysml.getResourceSet().getResource(primaryUri, false);
            if (stale != null) {
                sysml.getResourceSet().getResources().remove(stale);
                stale.unload();
            }

            // Load context files (only if not already present — they're stable within a session).
            for (String ctxPath : contextPaths) {
                File ctx = new File(ctxPath);
                if (!ctx.exists()) continue;
                URI ctxUri = URI.createFileURI(ctx.getAbsolutePath());
                if (sysml.getResourceSet().getResource(ctxUri, false) == null) {
                    sysml.getResourceSet().getResource(ctxUri, true).getContents();
                    hasContext = true;
                }
            }
        } finally {
            System.setOut(realOut);
        }

        try {
            Resource resource = sysml.getResourceSet()
                    .getResource(URI.createFileURI(primaryFile.getAbsolutePath()), true);

            // Resolve cross-references in the primary resource only.
            // Full-ResourceSet resolveAll is intentionally skipped: it re-traverses 94
            // stdlib resources on every request and triggers NPEs in derived-feature
            // adapters of the Pilot Implementation.
            try {
                EcoreUtil.resolveAll(resource);
            } catch (Exception ignored) {
                // Some cross-references may remain as proxies; crossRefName() handles
                // them via NodeModelUtils parse-tree fallback.
            }

            Set<EObject> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            List<Node> model = new ArrayList<>();
            for (EObject root : resource.getContents()) {
                model.add(buildNode(root, visited));
            }

            // Also build models for context files that are already in the ResourceSet.
            // These are returned as contextModels so the TypeScript side can resolve
            // cross-file port directions without making additional parse requests.
            List<List<Node>> contextModelsList = new ArrayList<>();
            for (String ctxPath : contextPaths) {
                URI ctxUri = URI.createFileURI(new File(ctxPath).getAbsolutePath());
                Resource ctxResource = sysml.getResourceSet().getResource(ctxUri, false);
                if (ctxResource == null || ctxResource.getContents().isEmpty()) continue;
                Set<EObject> ctxVisited = Collections.newSetFromMap(new IdentityHashMap<>());
                List<Node> ctxModel = new ArrayList<>();
                for (EObject root : ctxResource.getContents()) {
                    try { ctxModel.add(buildNode(root, ctxVisited)); } catch (Exception ignored) {}
                }
                if (!ctxModel.isEmpty()) contextModelsList.add(ctxModel);
            }

            boolean hasStdlib = (System.getenv("SYSML_STDLIB_PATH") != null);
            boolean suppress  = hasStdlib || hasContext;
            List<Diag> diags = new ArrayList<>();
            List<Resource.Diagnostic> trueErrors = new ArrayList<>();
            for (Resource.Diagnostic d : resource.getErrors()) {
                String msg = d.getMessage();
                if (suppress && msg != null && msg.startsWith("Couldn't resolve reference to")) {
                    // suppress cross-ref errors when stdlib/context is provided
                } else {
                    diags.add(new Diag("error", msg, d.getLine(), d.getColumn()));
                    trueErrors.add(d);
                }
            }
            for (Resource.Diagnostic d : resource.getWarnings()) {
                diags.add(new Diag("warning", d.getMessage(), d.getLine(), d.getColumn()));
            }

            return toJson(trueErrors.isEmpty(), diags, model, contextModelsList);
        } catch (Exception e) {
            return wrapperErrorJson(e);
        }
    }

    /** Extract a JSON string value by key (handles basic escape sequences). */
    private static String extractJsonString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        StringBuilder sb = new StringBuilder();
        int i = start;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char next = json.charAt(i + 1);
                switch (next) {
                    case '"':  sb.append('"');  i += 2; continue;
                    case '\\': sb.append('\\'); i += 2; continue;
                    case '/':  sb.append('/');  i += 2; continue;
                    case 'n':  sb.append('\n'); i += 2; continue;
                    case 'r':  sb.append('\r'); i += 2; continue;
                    case 't':  sb.append('\t'); i += 2; continue;
                    default:   sb.append(next); i += 2; continue;
                }
            }
            if (c == '"') break;
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    /** Extract a JSON string array value by key. */
    private static List<String> extractJsonStringArray(String json, String key) {
        String search = "\"" + key + "\":[";
        int start = json.indexOf(search);
        if (start < 0) return List.of();
        start += search.length();
        int end = json.indexOf("]", start);
        if (end < 0) return List.of();
        String content = json.substring(start, end);
        List<String> result = new ArrayList<>();
        int pos = 0;
        while (pos < content.length()) {
            int qstart = content.indexOf('"', pos);
            if (qstart < 0) break;
            StringBuilder sb = new StringBuilder();
            int i = qstart + 1;
            while (i < content.length()) {
                char c = content.charAt(i);
                if (c == '\\' && i + 1 < content.length()) {
                    char next = content.charAt(i + 1);
                    switch (next) {
                        case '"':  sb.append('"');  i += 2; continue;
                        case '\\': sb.append('\\'); i += 2; continue;
                        case '/':  sb.append('/');  i += 2; continue;
                        default:   sb.append(next); i += 2; continue;
                    }
                }
                if (c == '"') break;
                sb.append(c);
                i++;
            }
            result.add(sb.toString());
            pos = i + 1;
        }
        return result;
    }

    /** Compact a JSON string to a single line by removing whitespace outside strings. */
    private static String compactJson(String json) {
        StringBuilder sb = new StringBuilder(json.length());
        boolean inString = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (inString) {
                sb.append(c);
                if (c == '\\' && i + 1 < json.length()) sb.append(json.charAt(++i));
                else if (c == '"') inString = false;
            } else {
                if (c == '"') { inString = true; sb.append(c); }
                else if (c != ' ' && c != '\n' && c != '\r' && c != '\t') sb.append(c);
            }
        }
        return sb.toString();
    }

    // ── Debug mode ────────────────────────────────────────────────────────────

    /**
     * Debug mode: traverse every EObject reachable from the resource's top-level
     * contents and emit a flat JSON array with the full structural-feature dump
     * for each object.  Nothing is filtered.
     *
     * Output shape:
     * {
     *   "debug": true,
     *   "file": "<path>",
     *   "objects": [
     *     {
     *       "path": "0.1.2",         // index path through eContents()
     *       "eClass": "PartUsage",
     *       "features": {
     *         "name": "system",
     *         "isAbstract": false,
     *         "type": [{"eClass":"PartDefinition","name":"Engine"}],
     *         ...
     *       }
     *     },
     *     ...
     *   ]
     * }
     */
    private static void runDebug(String[] args) {
        if (args.length != 1) {
            emit(errorJson("Usage: java -jar sysml-parse-cli.jar --debug <file.sysml>"));
            System.exit(2);
        }

        File file = new File(args[0]);
        if (!file.exists()) {
            emit(errorJson("File not found: " + args[0]));
            System.exit(2);
        }

        try {
            System.err.println("[debug] Initialising SysML parser...");
            Injector injector = initSysML();

            XtextResourceSet resourceSet = injector.getInstance(XtextResourceSet.class);
            System.err.println("[debug] Loading resource: " + file.getAbsolutePath());
            Resource resource = resourceSet.getResource(
                    URI.createFileURI(file.getAbsolutePath()), true);

            System.err.println("[debug] Resource errors: " + resource.getErrors().size());
            System.err.println("[debug] Starting EObject traversal...");

            // Flat list of all visited objects (in traversal order)
            List<DebugEntry> entries = new ArrayList<>();
            Set<EObject> visited = Collections.newSetFromMap(new IdentityHashMap<>());

            for (int i = 0; i < resource.getContents().size(); i++) {
                collectDebugEntries(resource.getContents().get(i),
                                    String.valueOf(i), entries, visited);
            }

            System.err.println("[debug] Total EObjects collected: " + entries.size());

            emit(buildDebugJson(file.getAbsolutePath(), entries));
            System.exit(0);

        } catch (Exception e) {
            e.printStackTrace(System.err);
            emit(wrapperErrorJson(e));
            System.exit(2);
        }
    }

    /** Recursively collect DebugEntry for every EObject reachable via eContents(). */
    private static void collectDebugEntries(EObject obj, String path,
                                            List<DebugEntry> out, Set<EObject> visited) {
        if (!visited.add(obj)) return;

        String eClass = obj.eClass().getName();
        var features = new java.util.LinkedHashMap<String, Object>();

        for (EStructuralFeature f : obj.eClass().getEAllStructuralFeatures()) {
            Object raw;
            try { raw = obj.eGet(f); } catch (Exception ex) { continue; }
            if (raw == null) continue;

            Object serialized = serializeFeatureValue(f, raw);
            if (serialized != null) features.put(f.getName(), serialized);
        }

        out.add(new DebugEntry(path, eClass, features));

        List<EObject> contents;
        try { contents = obj.eContents(); } catch (Exception e) { return; }
        for (int i = 0; i < contents.size(); i++) {
            try {
                collectDebugEntries(contents.get(i), path + "." + i, out, visited);
            } catch (Exception e) { /* skip subtrees that trigger NPE in adapters */ }
        }
    }

    /**
     * Serialize a single structural feature value to a plain Java object
     * (String, Boolean, Number, List, Map) suitable for JSON rendering.
     *
     * - EAttribute (primitive/string/enum): the value itself
     * - EReference containment:            skipped (appears as separate entry)
     * - EReference non-containment:        {"eClass":"...", "name":"...", "proxy":bool}
     * - EList:                             list of the above; empty lists are skipped
     */
    @SuppressWarnings("unchecked")
    private static Object serializeFeatureValue(EStructuralFeature f, Object raw) {
        if (raw instanceof EList<?> list) {
            if (list.isEmpty()) return null;
            var result = new ArrayList<>();
            int limit = 0;
            for (Object item : list) {
                if (limit++ >= 50) {
                    result.add("...(truncated, total=" + list.size() + ")");
                    break;
                }
                Object s = serializeSingleValue(f, item);
                if (s != null) result.add(s);
            }
            return result.isEmpty() ? null : result;
        }
        return serializeSingleValue(f, raw);
    }

    private static Object serializeSingleValue(EStructuralFeature f, Object val) {
        if (val == null) return null;

        // Containment EReference: skip — it appears as a separate DebugEntry
        if (f instanceof EReference ref && ref.isContainment()) {
            return null;
        }

        // Non-containment EReference (cross-reference)
        if (val instanceof EObject eobj) {
            var map = new java.util.LinkedHashMap<String, Object>();
            map.put("eClass", eobj.eClass().getName());
            String n = nameOf(eobj);
            if (n != null) map.put("name", n);
            if (eobj.eIsProxy()) map.put("proxy", true);
            // Also include qualifiedName if available and different from name
            String qn = stringFeature(eobj, "qualifiedName");
            if (qn != null && !qn.equals(n)) map.put("qualifiedName", qn);
            return map;
        }

        // Primitives
        if (val instanceof String s)  return s;
        if (val instanceof Boolean b) return b;
        if (val instanceof Number n)  return n;

        // Enum literals (EMF generated enums implement toString)
        return val.toString();
    }

    /** Read a string-valued feature by name; returns null if absent or not a string. */
    private static String stringFeature(EObject obj, String featureName) {
        EStructuralFeature f = obj.eClass().getEStructuralFeature(featureName);
        if (f == null) return null;
        try {
            Object v = obj.eGet(f);
            return v instanceof String s ? s : null;
        } catch (Exception e) { return null; }
    }

    /** Serialize the collected entries to the debug JSON output. */
    private static String buildDebugJson(String filePath, List<DebugEntry> entries) {
        var sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"debug\": true,\n");
        sb.append("  \"file\": ").append(jsonStr(filePath)).append(",\n");
        sb.append("  \"objectCount\": ").append(entries.size()).append(",\n");
        sb.append("  \"objects\": [");

        for (int i = 0; i < entries.size(); i++) {
            if (i > 0) sb.append(",");
            DebugEntry e = entries.get(i);
            sb.append("\n    {\n");
            sb.append("      \"path\": ").append(jsonStr(e.path())).append(",\n");
            sb.append("      \"eClass\": ").append(jsonStr(e.eClass())).append(",\n");
            sb.append("      \"features\": {");

            var feats = e.features();
            int fi = 0;
            for (var entry : feats.entrySet()) {
                if (fi++ > 0) sb.append(",");
                sb.append("\n        ").append(jsonStr(entry.getKey())).append(": ");
                appendJsonValue(sb, entry.getValue());
            }

            if (!feats.isEmpty()) sb.append("\n      ");
            sb.append("}\n    }");
        }

        if (!entries.isEmpty()) sb.append("\n  ");
        sb.append("]\n}");
        return sb.toString();
    }

    /** Recursively write a plain-Java-object value as JSON. */
    private static void appendJsonValue(StringBuilder sb, Object val) {
        if (val == null) {
            sb.append("null");
        } else if (val instanceof String s) {
            sb.append(jsonStr(s));
        } else if (val instanceof Boolean b) {
            sb.append(b);
        } else if (val instanceof Number n) {
            sb.append(n);
        } else if (val instanceof List<?> list) {
            sb.append("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(", ");
                appendJsonValue(sb, list.get(i));
            }
            sb.append("]");
        } else if (val instanceof java.util.Map<?,?> map) {
            sb.append("{");
            boolean first = true;
            for (var entry : map.entrySet()) {
                if (!first) sb.append(", ");
                first = false;
                sb.append(jsonStr(entry.getKey().toString())).append(": ");
                appendJsonValue(sb, entry.getValue());
            }
            sb.append("}");
        } else {
            sb.append(jsonStr(val.toString()));
        }
    }

    // ── SysML initialisation ──────────────────────────────────────────────────

    /** Minimal Xtext setup used by debug mode (no library loading needed). */
    private static Injector initSysML() {
        EPackage.Registry.INSTANCE.put(SysMLPackage.eNS_URI, SysMLPackage.eINSTANCE);
        KerMLStandaloneSetup.doSetup();
        KerMLxStandaloneSetup.doSetup();
        SysMLxStandaloneSetup.doSetup();
        return new SysMLStandaloneSetup().createInjectorAndDoEMFRegistration();
    }

    // ── EMF traversal (normal mode) ───────────────────────────────────────────

    /**
     * Build a Node from an EObject, recursing through eContents().
     */
    private static Node buildNode(EObject obj, Set<EObject> visited) {
        if (!visited.add(obj)) {
            return new Node(obj.eClass().getName(), nameOf(obj), null, List.of(), 0, 0, null);
        }

        String emfType = obj.eClass().getName();
        String name    = nameOf(obj);

        // FeatureTyping.type is a cross-reference; resolve its name if available.
        if ("FeatureTyping".equals(emfType) && name == null) {
            name = crossRefName(obj, "type");
        }
        // ReferenceSubsetting.referencedFeature names the connected port endpoint.
        if ("ReferenceSubsetting".equals(emfType) && name == null) {
            name = crossRefName(obj, "referencedFeature");
            if (name == null) name = crossRefName(obj, "subsettedFeature");
        }
        // FeatureChaining.chainingFeature names one segment of a chained reference (e.g. tank.fuelOut).
        if ("FeatureChaining".equals(emfType) && name == null) {
            name = crossRefName(obj, "chainingFeature");
        }
        // LiteralBoolean/Integer/String — emit the literal value as the name so callers can read it.
        if ("LiteralBoolean".equals(emfType) && name == null) {
            name = literalValue(obj, "value");
        }
        if ("LiteralInteger".equals(emfType) && name == null) {
            name = literalValue(obj, "value");
        }
        if ("LiteralString".equals(emfType) && name == null) {
            name = literalValue(obj, "value");
        }
        // Membership.memberElement cross-reference resolves the referenced element name
        // (used inside FeatureReferenceExpression conditions).
        if ("Membership".equals(emfType) && name == null) {
            name = crossRefName(obj, "memberElement");
        }
        // Superclassing.general names the supertype in `part def A :> B { ... }`.
        // Extracting it lets graphBuilder emit specialization edges between PartDefinitions.
        if ("Superclassing".equals(emfType) && name == null) {
            name = crossRefName(obj, "general");
        }
        // Subsetting.subsettedFeature names the subsetted feature in `part a :>> b`.
        // Extracting it lets graphBuilder emit subsetting edges between PartUsages.
        if ("Subsetting".equals(emfType) && name == null) {
            name = crossRefName(obj, "subsettedFeature");
        }

        // Feature.direction attribute (FeatureDirectionKind enum: in, out, inout, none).
        // Emit when explicitly set to a directional value; omit for "none" (unset).
        String direction = null;
        EStructuralFeature dirFeature = obj.eClass().getEStructuralFeature("direction");
        if (dirFeature != null) {
            Object dirVal = obj.eGet(dirFeature);
            if (dirVal != null) {
                String dirStr = dirVal.toString();
                if (!"none".equals(dirStr) && !dirStr.isEmpty()) direction = dirStr;
            }
        }

        // Source location via Xtext parse-tree node model (1-based; 0 = unavailable)
        int startLine = 0, endLine = 0;
        try {
            ICompositeNode pn = NodeModelUtils.getNode(obj);
            if (pn != null) {
                startLine = pn.getStartLine();
                endLine   = pn.getEndLine();
            }
        } catch (Exception ignored) {}

        List<Node> children = new ArrayList<>();
        List<EObject> contents;
        try {
            contents = obj.eContents();
        } catch (Exception e) {
            contents = List.of();
        }
        for (EObject child : contents) {
            try {
                children.add(buildNode(child, visited));
            } catch (Exception e) {
                // Skip individual children that trigger NPE in Pilot Implementation adapters.
            }
        }
        // Feature.isComposite — false for 'ref part/item/...' usages (non-composite shared aggregation).
        Boolean isComposite = null;
        EStructuralFeature compositeFeature = obj.eClass().getEStructuralFeature("isComposite");
        if (compositeFeature != null) {
            try {
                Object val = obj.eGet(compositeFeature);
                if (val instanceof Boolean b) isComposite = b;
            } catch (Exception ignored) {}
        }

        return new Node(emfType, name, direction, children, startLine, endLine, isComposite);
    }

    private static String nameOf(EObject obj) {
        EStructuralFeature f = obj.eClass().getEStructuralFeature("name");
        if (f == null) return null;
        Object v = obj.eGet(f);
        return v instanceof String s ? s : null;
    }

    private static String crossRefName(EObject obj, String featureName) {
        EStructuralFeature f = obj.eClass().getEStructuralFeature(featureName);
        if (f == null) return null;
        try {
            Object val = obj.eGet(f);
            if (val instanceof EObject ref && !ref.eIsProxy()) {
                return nameOf(ref);
            }
            // Proxy (cross-file reference): resolve name from Xtext parse-tree text.
            // NodeModelUtils gives the exact source tokens covering the reference, so
            // qualified names like "Pkg::TypeName" return the last segment "TypeName".
            if (f instanceof EReference) {
                var nodes = NodeModelUtils.findNodesForFeature(obj, f);
                if (!nodes.isEmpty()) {
                    String text = NodeModelUtils.getTokenText(nodes.get(nodes.size() - 1)).trim();
                    if (!text.isEmpty()) return text;
                }
            }
        } catch (Exception e) {
            // Known Pilot Implementation bug: lazy type resolution for DecisionNode endpoints
            // can trigger NPE inside SuccessionAsUsageAdapter.  Swallow and return null.
        }
        return null;
    }

    /** Read a scalar attribute value (Boolean, Integer, String) and return it as a String. */
    private static String literalValue(EObject obj, String featureName) {
        EStructuralFeature f = obj.eClass().getEStructuralFeature(featureName);
        if (f == null) return null;
        try {
            Object val = obj.eGet(f);
            if (val == null) return null;
            return val.toString();
        } catch (Exception e) {
            return null;
        }
    }

    // ── stdout helpers ────────────────────────────────────────────────────────

    private static void emit(String json) {
        System.out.println(json);
        System.out.flush();
    }

    // ── JSON serialization — no external dependency ───────────────────────────

    private static String toJson(boolean success, List<Diag> diags, List<Node> model) {
        return toJson(success, diags, model, List.of());
    }

    private static String toJson(boolean success, List<Diag> diags, List<Node> model,
                                  List<List<Node>> contextModels) {
        var sb = new StringBuilder();
        sb.append("{\n  \"success\": ").append(success).append(",\n  \"diagnostics\": [");
        for (int i = 0; i < diags.size(); i++) {
            if (i > 0) sb.append(",");
            Diag d = diags.get(i);
            sb.append("\n    {")
              .append("\n      \"message\": ").append(jsonStr(d.message())).append(",")
              .append("\n      \"severity\": \"").append(d.severity()).append("\",")
              .append("\n      \"line\": ").append(d.line()).append(",")
              .append("\n      \"column\": ").append(d.column())
              .append("\n    }");
        }
        sb.append("\n  ],\n  \"model\": [");
        for (int i = 0; i < model.size(); i++) {
            if (i > 0) sb.append(",");
            appendNode(sb, model.get(i), 2);
        }
        if (!model.isEmpty()) sb.append("\n  ");
        sb.append("]");
        if (!contextModels.isEmpty()) {
            sb.append(",\n  \"contextModels\": [");
            for (int ci = 0; ci < contextModels.size(); ci++) {
                if (ci > 0) sb.append(",");
                sb.append("\n    [");
                List<Node> cm = contextModels.get(ci);
                for (int i = 0; i < cm.size(); i++) {
                    if (i > 0) sb.append(",");
                    appendNode(sb, cm.get(i), 3);
                }
                if (!cm.isEmpty()) sb.append("\n    ");
                sb.append("]");
            }
            sb.append("\n  ]");
        }
        return sb.append("\n}").toString();
    }

    private static void appendNode(StringBuilder sb, Node node, int depth) {
        String pad  = "  ".repeat(depth);
        String pad1 = "  ".repeat(depth + 1);
        sb.append("\n").append(pad).append("{")
          .append("\n").append(pad1).append("\"type\": ").append(jsonStr(node.type())).append(",")
          .append("\n").append(pad1).append("\"name\": ").append(jsonStr(node.name())).append(",");
        if (node.direction() != null) {
            sb.append("\n").append(pad1).append("\"direction\": ").append(jsonStr(node.direction())).append(",");
        }
        if (node.startLine() > 0) {
            sb.append("\n").append(pad1).append("\"startLine\": ").append(node.startLine()).append(",");
            sb.append("\n").append(pad1).append("\"endLine\": ").append(node.endLine()).append(",");
        }
        if (node.isComposite() != null && !node.isComposite()) {
            sb.append("\n").append(pad1).append("\"isComposite\": false,");
        }
        sb.append("\n").append(pad1).append("\"children\": [");
        List<Node> children = node.children();
        for (int i = 0; i < children.size(); i++) {
            if (i > 0) sb.append(",");
            appendNode(sb, children.get(i), depth + 2);
        }
        if (!children.isEmpty()) sb.append("\n").append(pad1);
        sb.append("]\n").append(pad).append("}");
    }

    private static String wrapperErrorJson(Throwable t) {
        String msg = t.getMessage() != null ? t.getMessage() : t.getClass().getName();
        return errorJson("Wrapper exception: " + msg);
    }

    private static String errorJson(String message) {
        return toJson(false, List.of(new Diag("error", message, 0, 0)), List.of());
    }

    private static String jsonStr(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\")
                       .replace("\"", "\\\"")
                       .replace("\n", "\\n")
                       .replace("\r", "\\r")
                       .replace("\t", "\\t")
               + "\"";
    }

    private record Diag(String severity, String message, int line, int column) {}
    private record Node(String type, String name, String direction, List<Node> children, int startLine, int endLine, Boolean isComposite) {}
    private record DebugEntry(String path, String eClass,
                              java.util.Map<String, Object> features) {}
}
