# Typed Part Usage Enforcement

This project now treats reusable architectural participants as typed part usages.

Preferred pattern:

```sysml
part def AcpdCdd_Input {
    port adcGroup0In : AdcGroup0InPort;
}

part def AcpdCdd {
    part input : AcpdCdd_Input;
}
```

Avoid for architecture/interaction/dataflow participants:

```sysml
part input;
part input {
    // anonymous structure
}
```

The checker `tools/check_typed_parts.py` enforces this for the architecture, runtime interaction, component sequence, interface contract, and dataflow files.

This is a project semantic-governance rule, separate from the official SysML/KerML validator wrapper.
