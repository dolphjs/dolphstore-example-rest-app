import "./shared/configs";

import { DolphFactory } from "@dolphjs/dolph";
import { IamComponent } from "./components/iam/iam.component";
import { PropertiesComponent } from "./components/properties/properties.component";

const dolph = new DolphFactory([IamComponent, PropertiesComponent]);
dolph.start();
