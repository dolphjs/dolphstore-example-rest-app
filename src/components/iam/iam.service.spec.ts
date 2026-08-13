import { IamService } from "./iam.service";

// Tier 1 (unit): services never need `@Component` to be constructed —
// replace this with real behaviour assertions as the service grows,
// passing mocked collaborators straight into the constructor.
describe("IamService", () => {
  it("is defined", () => {
    const service = new IamService();
    expect(service).toBeDefined();
  });
});
