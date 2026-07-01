# SignalConditioningAndProcessing — private-import multi-file project

This project is the latest XMI-derived SignalConditioningAndProcessing model split into OEM-oriented ownership packages.

All cross-package dependencies are now declared using **explicit `private import` statements**. No file uses a bare `import`, and no file uses `public import`. The imported names are used unqualified inside the owning package.

The semantic model content is unchanged relative to the latest qualified-reference split and the current consolidated single-file model:

- XMI-derived item and port definitions
- ASIL level metadata
- Realization metadata
- AcceleratorPedalSignalProcessing and SignalConditioningAndProcessingMain
- sequence behavior content
- 26 delegation `bind` relationships
- 26 internal `interface ... connect ...` relationships

The primary cluster is `SCP_Assembly::SignalConditioningAndProcessing` in `src/50_assembly/50_SCP_ClusterAssembly.sysml`.

`src/99_integration/99_SCP_Integration.sysml` is optional and exists only as a private-import workspace entry point; it does not redefine model content.

Load the entire extracted root as one Eclipse/Xtext project with the standard `sysml.library` project available.
