// Imported first so a misconfigured .env fails boot immediately with a
// readable error, before DolphFactory (or anything else) touches process.env.
import "./shared/configs";

import { DolphFactory } from "@dolphjs/dolph";
import { IamComponent } from "./components/iam/iam.component";

const dolph = new DolphFactory([IamComponent]);
dolph.start();
