import { IamController } from "./iam.controller";

// Tier 2 (unit): the controller is a plain class, so it's constructed
// directly here rather than through `@Component` — no Express, no DI.
// `greet()` uses Dolph's auto-return style, so its return value is
// asserted directly; mock `DRes()` instead if you switch a handler to
// writing to the response directly.
describe("IamController", () => {
  it("responds to GET /iam/greet", async () => {
    const controller = new IamController();

    const result = await controller.greet();

    expect(result).toEqual({ message: "you've reached the iam endpoint." });
  });
});
