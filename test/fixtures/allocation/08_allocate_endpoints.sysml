package AllocateEndpoints {
    part def SWFunction;
    part def HWNode;

    part def System {
        part sw1 : SWFunction;
        part sw2 : SWFunction;
        part hw1 : HWNode;
        part hw2 : HWNode;

        // two anonymous allocations
        allocate sw1 to hw1;
        allocate sw2 to hw2;
    }
}
