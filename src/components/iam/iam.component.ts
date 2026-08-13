import { Component } from "@dolphjs/dolph/decorators";
import { IamController } from "./iam.controller";
import { IamService } from "./iam.service";

@Component({ controllers: [IamController], services: [IamService] })
export class IamComponent {};