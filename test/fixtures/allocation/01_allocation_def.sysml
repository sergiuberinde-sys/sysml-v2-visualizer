package AllocationDef {
    part def LogicalFunction;
    part def HardwareNode;

    allocation def FunctionToNode {
        end logicalEnd : LogicalFunction;
        end hardwareEnd : HardwareNode;
    }
}
