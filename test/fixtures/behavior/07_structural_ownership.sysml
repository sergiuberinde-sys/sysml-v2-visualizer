// Regression fixture: ActionDefinition nested inside PartDefinition
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior:
//   ActionDefinition "Startup" has owningDefName="Controller", owningDefType="PartDefinition"
//   Actions: read, evaluate, activate with correct ownerId
//   Flows: read -> evaluate, evaluate -> activate
//   Dropdown label: Controller::Startup
package ComponentBehaviorExample {
    part def Controller {
        action def Startup {
            action read;
            action evaluate;
            action activate;

            succession first read then evaluate;
            succession first evaluate then activate;
        }
    }

    part system {
        part ctrl : Controller;
    }
}
