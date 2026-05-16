package NestedRequirements {
    requirement def Safety {
        requirement def BrakeResponse;
        requirement def SteerResponse;
    }

    requirement def Performance {
        requirement def AccelTime;
        requirement def TopSpeed;
    }
}
