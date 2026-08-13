import { DolphServiceHandler } from "@dolphjs/dolph/classes";
import { Dolph } from "@dolphjs/dolph/common";
import { DService } from "@dolphjs/dolph/decorators";

@DService()
export class IamService extends DolphServiceHandler<Dolph>{
    constructor() {
        super("iamService");
    }
}
