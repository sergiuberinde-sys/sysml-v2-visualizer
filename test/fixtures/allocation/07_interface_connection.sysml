package InterfaceConnectionExample {
    interface def DataBus;

    part def Node1 {
        port busPort : DataBus;
    }

    part def Node2 {
        port busPort : DataBus;
    }

    part def Network {
        part n1 : Node1;
        part n2 : Node2;
        connect n1.busPort to n2.busPort;
    }
}
