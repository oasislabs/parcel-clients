// This a cypress test for the login-with-oasis example (either the backend or the frontend version).
// You can execute it with
// $ cd gateway/clients/typescript && cypress run --config '{"baseUrl":"http://localhost:4050","integrationFolder":"test/examples","testFiles":["login-with-oasis.spec.js"],"chromeWebSecurity":false}'

// This test assumes the login-with-oasis example is already configured and listening on the baseUrl
// configured above.

it('login-with-oasis', () => {
  // Visit the base URL of the login-with-oasis-frontend example.
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

  // If token authorization succeeds, a div "Your Parcel identity  is <button with user identity>" is shown.
  cy.get('#parcel-id')
    .invoke('text')
    .should('match', /^I[A-Za-z\d]{10,}$/);

  // Also "You have X documents!" is shown, where X should be zero in our case.
  cy.get('#document-count').invoke('text').should('eq', '0');
});
