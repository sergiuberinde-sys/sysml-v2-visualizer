package ReqInPart {
    requirement def BrakeResponse;
    requirement def SteeringResponse;

    part def BrakeController {
        requirement brakeReq : BrakeResponse;
    }

    part def SteeringController {
        requirement steerReq : SteeringResponse;
        requirement brakeReq : BrakeResponse;
    }
}
