# Supported SysML v2 Syntax Subset

> This is a strict SysML v2-inspired subset. It is not yet full SysML v2
> conformance. Supported constructs are validated strictly.

---

## Table of Contents

1. [package](#1-package)
2. [interface def](#2-interface-def)
3. [part def](#3-part-def)
4. [part usage](#4-part-usage)
5. [port](#5-port)
6. [connect](#6-connect)
7. [occurrence def](#7-occurrence-def)
8. [message](#8-message)
9. [action def](#9-action-def)
10. [behavior def](#10-behavior-def)
11. [flow](#11-flow)
12. [state def](#12-state-def)
13. [transition](#13-transition)
14. [requirement def](#14-requirement-def)
15. [satisfy / verify / trace](#15-satisfy--verify--trace)

---

## 1. `package`

### Syntax

```
package Name;                // bare namespace declaration
package Name { ... }         // namespace block
```

### Valid example

```sysml
package VehicleSystems {
  interface def BrakeSignal;

  part def BrakePedal {
    port out pedal : BrakeSignal;
  }
}
```

### Invalid example

```sysml
package VehicleSystems {
  interface def BrakeSignal;
}

package VehicleSystems {     // duplicate package name in same namespace
  interface def AnotherSignal;
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |

---

## 2. `interface def`

### Syntax

```
interface def Name;
```

### Valid example

```sysml
interface def PedalPositionSignal;
interface def BrakeCommand;
```

### Invalid example

```sysml
interface def PedalPositionSignal;
interface def PedalPositionSignal;   // duplicate
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |
| Used as port type → must be declared | `UNKNOWN_INTERFACE` | error |

---

## 3. `part def`

### Syntax

```
part def Name {
  port in|out portName : InterfaceType;
  part alias : PartType;
  connect alias.port to alias.port;
}

part def Name;               // empty (no body)
```

### Valid example

```sysml
interface def BrakeSignal;

part def BrakePedal {
  port out pedalOut : BrakeSignal;
}

part def BrakeController {
  port in ctrlIn : BrakeSignal;
}

part def BrakeSystem {
  part pedal      : BrakePedal;
  part controller : BrakeController;
  connect pedal.pedalOut to controller.ctrlIn;
}
```

### Invalid example

```sysml
part def BrakeSystem {
  part pedal : UnknownPart;                     // UNKNOWN_PART
  connect pedal.out to controller.in;           // UNKNOWN_PART (controller not declared)
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |
| Port type not declared | `UNKNOWN_INTERFACE` | error |
| Part usage type not declared | `UNKNOWN_PART` | error |
| Connection part instance not declared | `UNKNOWN_PART` | error |
| Connection port does not exist on the part type | `UNKNOWN_PORT` | error |
| Connected ports have same direction | `INCOMPATIBLE_PORT_DIRECTIONS` | error |
| Connected ports have reverse direction (in→out) | `INCOMPATIBLE_PORT_DIRECTIONS` | warning |
| Connected ports carry different interface types | `INCOMPATIBLE_PORT_TYPES` | error |

---

## 4. `part usage`

### Syntax

```
part name : PartType;
```

Used inside `part def` bodies to declare sub-part composition, and inside
`occurrence def` bodies to declare participants.

### Valid example

```sysml
part def Engine;
part def Vehicle {
  part engine : Engine;
}
```

### Invalid example

```sysml
part def Vehicle {
  part engine : Motor;   // UNKNOWN_PART — Motor is not declared
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Type not a declared `part def` | `UNKNOWN_PART` | error |

---

## 5. `port`

### Syntax

```
port in  Name : InterfaceType;
port out Name : InterfaceType;
```

Only valid inside a `part def` body.

### Valid example

```sysml
interface def CanFrame;

part def Ecu {
  port in  canRx : CanFrame;
  port out canTx : CanFrame;
}
```

### Invalid example

```sysml
part def Ecu {
  port out canTx : UnknownSignal;   // UNKNOWN_INTERFACE
}

port out freePort : SomeType;       // WRONG_CONTEXT — port outside part def
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Port type not declared | `UNKNOWN_INTERFACE` | error |
| Port declared outside a `part def` | `WRONG_CONTEXT` | error |

---

## 6. `connect`

### Syntax

```
connect fromPart.fromPort to toPart.toPort;
```

Only valid inside a `part def` body.  Both `fromPart` and `toPart` must be
`part usage` aliases declared in the same `part def`.

### Valid example

```sysml
interface def Signal;

part def Sender   { port out tx : Signal; }
part def Receiver { port in  rx : Signal; }

part def Network {
  part s : Sender;
  part r : Receiver;
  connect s.tx to r.rx;   // out→in, same type — valid
}
```

### Invalid example

```sysml
interface def SigA;
interface def SigB;

part def A { port out p : SigA; }
part def B { port in  q : SigB; }

part def System {
  part a : A;
  part b : B;
  connect a.p to b.q;     // INCOMPATIBLE_PORT_TYPES: SigA ≠ SigB
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Source part instance not declared | `UNKNOWN_PART` | error |
| Target part instance not declared | `UNKNOWN_PART` | error |
| Source port not declared on its part type | `UNKNOWN_PORT` | error |
| Target port not declared on its part type | `UNKNOWN_PORT` | error |
| Both ports have the same direction | `INCOMPATIBLE_PORT_DIRECTIONS` | error |
| Source is `in`, target is `out` (reverse flow) | `INCOMPATIBLE_PORT_DIRECTIONS` | warning |
| Ports carry different interface types | `INCOMPATIBLE_PORT_TYPES` | error |
| Connection declared outside a `part def` | `WRONG_CONTEXT` | error |

---

## 7. `occurrence def`

### Syntax

```
occurrence def Name {
  part alias : PartType;
  message name from alias to alias;
}

occurrence def Name;    // empty
```

### Valid example

```sysml
part def Driver;
part def BrakePedal;

occurrence def NormalBraking {
  part driver : Driver;
  part pedal  : BrakePedal;

  message pedalPressed from driver to pedal;
}
```

### Invalid example

```sysml
part def Driver;
part def BrakePedal;

occurrence def NormalBraking {
  part driver : Driver;
  part pedal  : BrakePedal;

  message pedalPressed from Driver to BrakePedal;  // UNKNOWN_PARTICIPANT — types, not aliases
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Participant type not a declared `part def` | `UNKNOWN_PART` | error |
| Message endpoint is not a declared participant alias | `UNKNOWN_PARTICIPANT` | error |
| Message endpoint matches a type name (not alias) | `UNKNOWN_PARTICIPANT` | error |
| Duplicate message name inside the occurrence | `DUPLICATE_NAME` | error |
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |

---

## 8. `message`

### Syntax

```
message name from participantAlias to participantAlias;
```

Only valid inside an `occurrence def` body.

### Valid example

```sysml
part def A;
part def B;

occurrence def Seq {
  part a : A;
  part b : B;
  message req from a to b;
  message ack from b to a;
}
```

### Invalid example

```sysml
part def A;
part def B;

occurrence def Seq {
  part a : A;
  part b : B;
  message req from a  to b;
  message req from b  to a;   // DUPLICATE_NAME — "req" already declared
}

message orphan from x to y;   // WRONG_CONTEXT — message outside occurrence def
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| `from` does not reference a declared participant alias | `UNKNOWN_PARTICIPANT` | error |
| `to` does not reference a declared participant alias | `UNKNOWN_PARTICIPANT` | error |
| Duplicate message name within the occurrence | `DUPLICATE_NAME` | error |
| Message declared outside an `occurrence def` | `WRONG_CONTEXT` | error |

---

## 9. `action def`

### Syntax

```
action def Name;
```

### Valid example

```sysml
action def ApplyBrake;
action def ReleaseBrake;
```

### Invalid example

```sysml
action def ApplyBrake;
action def ApplyBrake;   // DUPLICATE_NAME
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |
| Referenced in behavior but not declared | `UNKNOWN_ACTION` | error |

---

## 10. `behavior def`

### Syntax

```
behavior def Name {
  action instanceName : ActionDefName;
  flow from -> to;
}

behavior def Name;    // empty
```

### Valid example

```sysml
action def Sense;
action def Compute;
action def Actuate;

behavior def BrakeControl {
  action sense   : Sense;
  action compute : Compute;
  action actuate : Actuate;
  flow sense   -> compute;
  flow compute -> actuate;
}
```

### Invalid example

```sysml
action def Sense;

behavior def BrakeControl {
  action sense : Sense;
  flow sense -> missing;    // UNKNOWN_ACTION — "missing" not declared
  flow sense -> sense;      // SELF_FLOW warning
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Action instance type not declared | `UNKNOWN_ACTION` | error |
| Duplicate action instance name | `DUPLICATE_NAME` | error |
| Flow endpoint not a declared action instance | `UNKNOWN_ACTION` | error |
| Flow connects an action to itself | `SELF_FLOW` | warning |

---

## 11. `flow`

### Syntax

```
flow fromAction -> toAction;
```

Only valid inside a `behavior def` body.

### Valid example

```sysml
action def Init;
action def Run;

behavior def Startup {
  action init : Init;
  action run  : Run;
  flow init -> run;
}
```

### Invalid example

```sysml
flow orphan -> elsewhere;    // WRONG_CONTEXT — flow outside behavior def
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Source action not a declared instance in the behavior | `UNKNOWN_ACTION` | error |
| Target action not a declared instance in the behavior | `UNKNOWN_ACTION` | error |
| Source and target are the same action instance | `SELF_FLOW` | warning |
| Flow declared outside a `behavior def` | `WRONG_CONTEXT` | error |

---

## 12. `state def`

### Syntax

```
state def Name {
  state StateName;
  initial -> StateName;
  transition From -> To;
  transition From -> To on EventName;
}

state def Name;    // empty
```

### Valid example

```sysml
state def BrakeStateMachine {
  state Idle;
  state Braking;
  state Released;

  initial -> Idle;
  transition Idle     -> Braking  on pedalPressed;
  transition Braking  -> Released on pedalReleased;
  transition Released -> Idle;
}
```

### Invalid example

```sysml
state def BrakeStateMachine {
  state Idle;
  state Braking;

  transition Idle -> Unknown;     // UNKNOWN_STATE — "Unknown" not declared
                                  // also MISSING_INITIAL_STATE warning
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Duplicate state name within the machine | `DUPLICATE_NAME` | error |
| Transition from unknown state | `UNKNOWN_STATE` | error |
| Transition to unknown state | `UNKNOWN_STATE` | error |
| Initial transition targets unknown state | `UNKNOWN_STATE` | error |
| State machine has states but no initial transition | `MISSING_INITIAL_STATE` | warning |
| Two transitions from same state on same event | `DUPLICATE_TRANSITION` | error |

---

## 13. `transition`

### Syntax

```
initial -> TargetState;
transition FromState -> ToState;
transition FromState -> ToState on EventName;
```

Only valid inside a `state def` body.

### Valid example

```sysml
state def Simple {
  state Off;
  state On;
  initial -> Off;
  transition Off -> On  on start;
  transition On  -> Off on stop;
}
```

### Invalid example

```sysml
state def Simple {
  state Off;
  state On;
  initial -> Off;
  transition Off -> On on start;
  transition Off -> On on start;   // DUPLICATE_TRANSITION — non-deterministic
}

transition Idle -> Braking;        // WRONG_CONTEXT — transition outside state def
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Source state not declared | `UNKNOWN_STATE` | error |
| Target state not declared | `UNKNOWN_STATE` | error |
| Duplicate (from, event) pair within a state machine | `DUPLICATE_TRANSITION` | error |
| Transition declared outside a `state def` | `WRONG_CONTEXT` | error |

---

## 14. `requirement def`

### Syntax

```
requirement def Name {
  id       = "REQ-XXX";
  text     = "The system shall ...";
  priority = "High";
}

requirement def Name;    // empty (id/text will be flagged as missing)
```

### Valid example

```sysml
requirement def SafeBraking {
  id       = "REQ-001"
  text     = "The system shall decelerate within 3 s of pedal input."
  priority = "High"
}
```

### Invalid example

```sysml
requirement def IncompletReq {
  text = "Missing id field"    // MISSING_REQUIREMENT_ID error
}

requirement def DuplicateId {
  id   = "REQ-001"             // DUPLICATE_REQUIREMENT_ID — id used above
  text = "Duplicate id"
}
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| `id` field missing or empty | `MISSING_REQUIREMENT_ID` | error |
| Two requirements share the same `id` | `DUPLICATE_REQUIREMENT_ID` | error |
| `text` field missing or empty | `MISSING_REQUIREMENT_TEXT` | info |
| Duplicate name in same namespace | `DUPLICATE_NAME` | error |

---

## 15. `satisfy` / `verify` / `trace`

### Syntax

```
satisfy sourceName satisfies requirementName;
verify  sourceName verifies  requirementName;
trace   sourceName traces    requirementName;
```

The source must be a named element declared in the model.
The target must be a declared `requirement def`.

### Valid example

```sysml
part def BrakePedal;

requirement def SafeBraking {
  id   = "REQ-001"
  text = "The system shall decelerate within 3 s."
}

satisfy BrakePedal satisfies SafeBraking;
```

### Invalid example

```sysml
requirement def SafeBraking {
  id   = "REQ-001"
  text = "The system shall decelerate within 3 s."
}

satisfy NoSuchElement satisfies SafeBraking;      // BROKEN_TRACE_LINK — source not found
satisfy BrakePedal    satisfies NoSuchReq;         // BROKEN_TRACE_LINK — target not found

interface def Signal;
satisfy Signal satisfies SafeBraking;              // SUSPICIOUS_TRACE_LINK — wrong source kind
```

### Validation rules

| Rule | Diagnostic | Severity |
|---|---|---|
| Source element not found in model | `BROKEN_TRACE_LINK` | error |
| Source name is ambiguous (multiple namespaces) | `AMBIGUOUS_REFERENCE` | error |
| Target is not a declared `requirement def` | `BROKEN_TRACE_LINK` | error |
| `satisfy` source is not a part/behavior/occurrence/state machine | `SUSPICIOUS_TRACE_LINK` | warning |
| `verify` source is not an occurrence/behavior/state machine | `SUSPICIOUS_TRACE_LINK` | warning |

---

## Diagnostic Code Reference

| Code | Severity | Meaning |
|---|---|---|
| `DUPLICATE_NAME` | error | Two elements share a name in the same namespace |
| `UNKNOWN_INTERFACE` | error | Port type is not a declared `interface def` or `part def` |
| `UNKNOWN_PART` | error | Part usage or participant type is not a declared `part def` |
| `UNKNOWN_PORT` | error | Port referenced in `connect` is not declared on the part type |
| `UNKNOWN_PARTICIPANT` | error | Message endpoint is not a declared participant alias |
| `UNKNOWN_ACTION` | error | Flow endpoint or action type is not declared |
| `UNKNOWN_STATE` | error | Transition references a state not declared in the machine |
| `WRONG_CONTEXT` | error | Construct appears outside its valid parent block |
| `AMBIGUOUS_REFERENCE` | error | Name exists in multiple namespaces; use qualified name |
| `INCOMPATIBLE_PORT_TYPES` | error | Connected ports carry different interface types |
| `INCOMPATIBLE_PORT_DIRECTIONS` | error/warning | Port directions incompatible with standard data flow |
| `SELF_FLOW` | warning | Flow connects an action to itself |
| `DUPLICATE_TRANSITION` | error | Two transitions from same state on same event |
| `MISSING_INITIAL_STATE` | warning | State machine with states but no `initial ->` transition |
| `BROKEN_TRACE_LINK` | error | Trace link source or target cannot be resolved |
| `SUSPICIOUS_TRACE_LINK` | warning | Trace link source has an unexpected element kind |
| `DUPLICATE_REQUIREMENT_ID` | error | Two requirements share the same `id` value |
| `MISSING_REQUIREMENT_ID` | error | Requirement has no `id` field |
| `MISSING_REQUIREMENT_TEXT` | info | Requirement has no `text` field |

---

## Out of Scope (Unsupported SysML v2)

The following SysML v2 constructs are **not yet supported** and will produce
parser warnings if encountered:

- `attribute def` / `item def` / `calc def` / `constraint def`
- Generalization / specialization (`:>`)
- Redefinition (`redefines`)
- `import` / `alias`
- `ref` usages
- Multiplicities (`[0..*]`, `[1]`)
- `perform` / `exhibit` / `send` / `bind` / `succession`
- `doc` / `comment` annotations
- `metadata def`
- `use case def`
- `allocation def`
