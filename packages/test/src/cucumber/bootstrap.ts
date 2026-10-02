import { After, Before, setWorldConstructor } from '@cucumber/cucumber';
import { XqWorld } from './world.js';

setWorldConstructor(XqWorld);

Before(async function (this: XqWorld) {
  this.initialize();
});

After(async function (this: XqWorld) {
  await this.close();
});
