import "./shared/configs";

import { DolphFactory } from "@dolphjs/dolph";
import { IamComponent } from "./components/iam/iam.component";

const dolph = new DolphFactory([IamComponent]);
dolph.start();
