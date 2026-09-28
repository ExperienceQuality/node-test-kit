export const setupPlatform: Cypress.PluginConfig = (on, config) => {
  on('before:run', () => {
    console.log('@xq/test-cypress: before:run');
  });

  return config;
};
