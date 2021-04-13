// This a cypress test for login-with-oasis example.
// You can execute it with
// $ cd gateway/clients/typescript && cypress run --config '{"baseUrl":"http://localhost:4050","integrationFolder":"test/examples","testFiles":["login-with-oasis.spec.js"],"chromeWebSecurity":false}'

// This test assumes a fresh instance of parcel-gateway, auth backend and frontend with reverse proxy,
// and a running login-with-oasis example in the background.

it('login-with-oasis', () => {
  // Visit the base URL of the login-with-oasis example.
  cy.visit('/');
  cy.contains('Get started with Oasis').click();

  // Click the TEST LOGIN button.
  cy.url().should('include', 'signin');
  cy.url().should('include', 'requestId');
  cy.contains('Log in to Oasis to continue');
  cy.get('[data-cy=sign-in-test]').click();
  cy.get('[data-cy=submit-jwk]').click();

  // Agreement checkboxes.
  cy.contains("I have read and understood the Oasis Labs' Privacy Policy").click();
  cy.contains("I have read and understood the Oasis Labs' Terms and Conditions").click();
  cy.contains('Share and continue').click();

  // If token authorization succeeds, a div "Your user id is <button with user identity>" is shown.
  cy.get('#user-id')
    .invoke('text')
    .should('match', /^I[A-Za-z\d]{10,}$/);
});
