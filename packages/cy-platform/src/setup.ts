export const setupPlatform: Cypress.PluginConfig = (on, config) => {
  on('before:run', () => {
    console.log('cy-platform: before:run');
  });

  return config;
};
