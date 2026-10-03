import { After, AfterAll, Before, BeforeAll, setWorldConstructor } from '@cucumber/cucumber';
import { registerJsonTableExpectation } from './json-expect.js';
import { startCucumberStub, stopCucumberStub } from './stub-lifecycle.js';
import { XqWorld } from './world.js';

registerJsonTableExpectation();
setWorldConstructor(XqWorld);

BeforeAll(async () => {
  await startCucumberStub();
});

AfterAll(async () => {
  await stopCucumberStub();
});

Before(async function (this: XqWorld) {
  this.initialize();
});

After(async function (this: XqWorld) {
  await this.close();
});
