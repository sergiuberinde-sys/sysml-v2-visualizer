package SequenceDiagramTest {

    private import ExecSpecTypes::*;

    attribute credentialsValid : ScalarValues::Boolean;

    part def Client_Participant {
        event occurrence sendLoginRequest;
        event occurrence receiveAuthToken;   // success branch
        event occurrence receiveAuthError;   // failure branch
        event occurrence sendDataRequest;
        event occurrence receiveData;
    }

    part def AuthService_Participant {
        event occurrence receiveLoginRequest;
        event occurrence queryCredentialStore;
        event occurrence receiveCredentialResult;
        event occurrence sendAuthToken;      // success branch
        event occurrence sendAuthError;      // failure branch
    }

    part def CredentialStore_Participant {
        event occurrence receiveCredentialQuery;
        event occurrence returnCredentialResult;
    }

    part def DataService_Participant {
        event occurrence receiveDataRequest;
        event occurrence returnData;
    }

    action def UserSession_Sequence {

        part client          : Client_Participant;
        part authService     : AuthService_Participant;
        part credentialStore : CredentialStore_Participant;
        part dataService     : DataService_Participant;

        // 1. Client sends login credentials.
        message login
            from client.sendLoginRequest
            to authService.receiveLoginRequest;

        // 2. Auth service validates against the credential store.
        message queryCredentials
            from authService.queryCredentialStore
            to credentialStore.receiveCredentialQuery;

        message credentialResult
            from credentialStore.returnCredentialResult
            to authService.receiveCredentialResult;

        // 3. [alt] Authentication outcome.
        if credentialsValid {
            message issueToken
                from authService.sendAuthToken
                to client.receiveAuthToken;
        } else {
            message authFailed
                from authService.sendAuthError
                to client.receiveAuthError;
        }

        // 4. Client fetches data after successful authentication.
        message fetchData
            from client.sendDataRequest
            to dataService.receiveDataRequest;

        message dataResponse
            from dataService.returnData
            to client.receiveData;
    }

    action userSession : UserSession_Sequence;

    // Interconnect view test: same participants/messages in a part def scope.
    // Open the Interconnect view and select "UserSession_Interconnect" to see
    // the message flows as dashed light-blue arrows between the four parts.
    part def UserSession_Interconnect {

        part client          : Client_Participant;
        part authService     : AuthService_Participant;
        part credentialStore : CredentialStore_Participant;
        part dataService     : DataService_Participant;

        message login
            from client.sendLoginRequest
            to authService.receiveLoginRequest;

        message queryCredentials
            from authService.queryCredentialStore
            to credentialStore.receiveCredentialQuery;

        message credentialResult
            from credentialStore.returnCredentialResult
            to authService.receiveCredentialResult;

        message issueToken
            from authService.sendAuthToken
            to client.receiveAuthToken;

        message fetchData
            from client.sendDataRequest
            to dataService.receiveDataRequest;

        message dataResponse
            from dataService.returnData
            to client.receiveData;
    }

    // Actions view test — two variants of port declaration syntax.
    //
    // VehicleController  → uses explicit "in item" / "out item" keywords
    // VehicleController2 → uses bare "in" / "out" (standard idiomatic SysML v2 form)
    //
    // In the Actions view, select:
    //   • "VehicleController::updateOutputProcedure"  — explicit in/out item ports
    //   • "VehicleController2::updateOutputProcedure" — bare in/out ports
    // Both should show port pins and the two item-flow arrows.

    part def VehicleController {

        port sensorInput   : SensorDataPort;
        port controlOutput : ActuatorPort;

        action updateOutputProcedure {

            action receiveSensorData : RCVSENS;

            then action processSensorData {
                in  item inRawReading  : SensorReading;
                out item outControlCmd : ControlCommand;
            }

            then action sendControlCommand {
                in item controlCmd : ControlCommand;
            }

            flow from receiveSensorData.rawSensorReading to processSensorData.inRawReading;
            flow from processSensorData.outControlCmd    to sendControlCommand.controlCmd;
        }
    }

    part def VehicleController2 {

        action updateOutputProcedure {

            action receiveSensorData2 {
                out rawSensorReading : SensorReading;
            }

            then action processSensorData2 {
                in  inRawReading  : SensorReading;
                out outControlCmd : ControlCommand;
            }

            then action sendControlCommand2 {
                in controlCmd : ControlCommand;
            }

            flow from receiveSensorData2.rawSensorReading to processSensorData2.inRawReading;
            flow from processSensorData2.outControlCmd    to sendControlCommand2.controlCmd;
        }
    }
}
