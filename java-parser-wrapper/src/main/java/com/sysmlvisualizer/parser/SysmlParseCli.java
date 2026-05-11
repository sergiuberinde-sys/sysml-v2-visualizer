package com.sysmlvisualizer.parser;

import com.google.inject.Injector;
import org.eclipse.emf.common.util.EList;
import org.eclipse.emf.common.util.URI;
import org.eclipse.emf.ecore.EObject;
import org.eclipse.emf.ecore.EPackage;
import org.eclipse.emf.ecore.EReference;
import org.eclipse.emf.ecore.EStructuralFeature;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.xtext.resource.XtextResourceSet;
import org.omg.kerml.xtext.KerMLStandaloneSetup;
import org.omg.kerml.xtext.xmi.KerMLxStandaloneSetup;
import org.omg.sysml.lang.sysml.SysMLPackage;
import org.omg.sysml.xtext.SysMLStandaloneSetup;
import org.omg.sysml.xtext.xmi.SysMLxStandaloneSetup;

import java.io.File;
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
 *
 * Exit codes:
 *   0  parsed without errors (warnings may be present)
 *   1  parse errors present
 *   2  invocation error (wrong args, file missing, JVM setup failure)
 */
public class SysmlParseCli {

    public static void main(String[] args) {
        boolean debug = args.length > 0 && "--debug".equals(args[0]);
        String[] rest = debug ? Arrays.copyOfRange(args, 1, args.length) : args;

        try {
            if (debug) {
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
        if (args.length != 1) {
            emit(errorJson("Usage: java -jar sysml-parse-cli.jar <file.sysml>"));
            System.exit(2);
        }

        File file = new File(args[0]);
        if (!file.exists()) {
            emit(errorJson("File not found: " + args[0]));
            System.exit(2);
        }

        try {
            Injector injector = initSysML();

            XtextResourceSet resourceSet = injector.getInstance(XtextResourceSet.class);
            Resource resource = resourceSet.getResource(
                    URI.createFileURI(file.getAbsolutePath()), true);

            List<Diag> diags = new ArrayList<>();
            for (Resource.Diagnostic d : resource.getErrors()) {
                diags.add(new Diag("error", d.getMessage(), d.getLine(), d.getColumn()));
            }
            for (Resource.Diagnostic d : resource.getWarnings()) {
                diags.add(new Diag("warning", d.getMessage(), d.getLine(), d.getColumn()));
            }

            Set<EObject> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            List<Node> model = new ArrayList<>();
            for (EObject root : resource.getContents()) {
                model.add(buildNode(root, visited));
            }

            boolean success = resource.getErrors().isEmpty();
            emit(toJson(success, diags, model));
            System.exit(success ? 0 : 1);

        } catch (Exception e) {
            e.printStackTrace(System.err);
            emit(wrapperErrorJson(e));
            System.exit(2);
        }
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

        List<EObject> contents = obj.eContents();
        for (int i = 0; i < contents.size(); i++) {
            collectDebugEntries(contents.get(i), path + "." + i, out, visited);
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

    /**
     * Full initialization sequence required by the Pilot Implementation.
     * Mirrors SysMLInteractive.createInstance() exactly; omitting any step
     * causes EMF proxy resolution to fail at parse time.
     */
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
            return new Node(obj.eClass().getName(), nameOf(obj), null, List.of());
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
        return new Node(emfType, name, direction, children);
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
        return sb.append("]\n}").toString();
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
    private record Node(String type, String name, String direction, List<Node> children) {}
    private record DebugEntry(String path, String eClass,
                              java.util.Map<String, Object> features) {}
}
