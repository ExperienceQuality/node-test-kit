import { defineCucumberConfig } from '@experiencequality/test/cucumber/config';

export default defineCucumberConfig({
  steps: 'features/steps/**/*.ts',
  reportPath: process.env.XQ_CUCUMBER_REPORT_PATH
});
