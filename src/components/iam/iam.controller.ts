import { DolphControllerHandler } from "@dolphjs/dolph/classes";
import { Dolph } from "@dolphjs/dolph/common";
import { Get, Route } from "@dolphjs/dolph/decorators";
import { IamService } from "./iam.service";

@Route('iam')
export class IamController extends DolphControllerHandler<Dolph> {
  constructor(private iamService: IamService
  ) {
    super();
    }

  @Get("greet")
  async greet() {
    return { message: "you've reached the iam endpoint." };
    };
}
