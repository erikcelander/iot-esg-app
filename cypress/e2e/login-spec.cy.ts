/**
 * Spec requirements: A01
 */
describe("login flow", () => {
  it("successfully logs in as tenant", () => {
    cy.login(Cypress.env("tenant_username"), Cypress.env("tenant_password"))
    cy.contains("nav a", /Temperature/)
  })

  it("successfully logs in as property owner", () => {
    cy.login(Cypress.env("propertyowner_username"), Cypress.env("propertyowner_password"))
    cy.contains("main button", /Download report/)
  })
});
