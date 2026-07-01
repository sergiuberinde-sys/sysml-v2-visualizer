# Private-import split update report

## Scope

This project is the current qualified-reference split regenerated as an import-based split. The only intended SysML text changes are:

1. insertion of explicit `private import <Package>::*;` declarations;
2. replacement of cross-package qualified names with imported unqualified names;
3. addition of one optional private-import workspace entry file.

No bare `import` declarations and no `public import` declarations are present.

## Private import count

- `private import` declarations: **18**
- bare `import` declarations: **0**
- `public import` declarations: **0**

## Content-preservation counts

| Element kind | Qualified-reference source | Private-import result |
|---|---:|---:|
| Named definitions | 166 | 166 |
| ASIL annotations | 71 | 71 |
| Realization annotations | 4 | 4 |
| Delegation bindings | 26 | 26 |
| Assembly connectors | 26 | 26 |

## Package dependency direction

- `SCP_Foundation` has no imports.
- `SCP_Interfaces`, action-signature packages import `SCP_Foundation`.
- Activity-body packages import only their required signature package and `SCP_Foundation`.
- `SCP_LogicalFunctions` imports interfaces, relevant behavior, main action signatures, and foundation metadata.
- `SCP_Interactions` imports logical functions.
- `SCP_Assembly` imports foundation, interfaces, logical functions, main behavior, and interactions.

No package import cycle was intentionally introduced.

## Validation performed

- checked that every SysML import is `private import`;
- checked that no bare or public imports exist;
- compared high-level semantic counts against the qualified-reference source;
- checked brace balance per SysML file;
- archive CRC/listing and extraction verification completed after packaging.

The existing parser status of activity/sequence semantics is unchanged; this split does not attempt to repair inherited model issues.
