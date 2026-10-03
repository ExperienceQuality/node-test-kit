import { After, Before, setWorldConstructor } from '@cucumber/cucumber';
import { registerJsonTableExpectation } from './json-expect.js';
import { XqWorld } from './world.js';

registerJsonTableExpectation();
setWorldConstructor(XqWorld);

Before(async function (this: XqWorld) {
  this.initialize();
});

After(async function (this: XqWorld) {
  await this.close();
});
