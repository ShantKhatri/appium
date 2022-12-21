import path from 'node:path';
import {createSandbox, SinonSandbox} from 'sinon';
import {Context, Converter} from 'typedoc';
import {
  BuiltinExternalDriverConverter,
  BuiltinMethodMapConverter,
  createReflections,
  ExternalConverter,
  NAME_BUILTIN_COMMAND_MODULE,
  NAME_TYPES_MODULE,
} from '../../../lib/converter';
import {AppiumPluginLogger} from '../../../lib/logger';
import {CommandReflection, CommandsReflection, ProjectCommands} from '../../../lib/model';
import {initAppForPkgs, NAME_FAKE_DRIVER_MODULE, ROOT_TSCONFIG} from '../helpers';

const {expect} = chai;

describe('command data builder', function () {
  let sandbox: SinonSandbox;
  beforeEach(function () {
    sandbox = createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('createReflections()', function () {
    let moduleCommands: ProjectCommands;
    let ctx: Context;
    let log: AppiumPluginLogger;
    let cmdsRefls!: CommandsReflection[];

    before(async function () {
      const app = await initAppForPkgs(
        ROOT_TSCONFIG,
        NAME_TYPES_MODULE,
        NAME_FAKE_DRIVER_MODULE,
        NAME_BUILTIN_COMMAND_MODULE
      );
      log = new AppiumPluginLogger(app.logger, 'appium-test');
      ({moduleCommands, ctx} = await new Promise((resolve) => {
        // this is really way too similar to what happens in the plugin itself
        app.converter.once(Converter.EVENT_RESOLVE_BEGIN, (ctx: Context) => {
          const builtinConverter = new BuiltinExternalDriverConverter(
            ctx,
            log.createChildLogger('builtin-types')
          );
          const knownMethods = builtinConverter.convert();
          const builtinMethodMapConverter = new BuiltinMethodMapConverter(
            ctx,
            log.createChildLogger('builtin-methods'),
            knownMethods
          );
          const builtinSource = builtinMethodMapConverter.convert();
          const fakeDriverConverter = new ExternalConverter(
            ctx,
            log.createChildLogger('fake-driver'),
            knownMethods,
            builtinSource?.moduleCmds
          );
          resolve({moduleCommands: fakeDriverConverter.convert(), ctx});
        });
        app.converter.convert(app.getEntryPoints()!);
      }));

      expect(() => (cmdsRefls = createReflections(ctx, log, moduleCommands))).not.to.throw();
    });

    describe('when the parameters from the method map do not match the method parameters', function () {
      it('should prefer the method map parameters', function () {
        const fakeDriverCmdsRefl = cmdsRefls.find(({name}) => name === NAME_FAKE_DRIVER_MODULE)!;
        expect(fakeDriverCmdsRefl).to.exist;
        const sessionRouteRefl = fakeDriverCmdsRefl.children!.filter(
          (child: CommandReflection) => child.name === '/session' && child.httpMethod === 'POST'
        );
        sessionRouteRefl; //?
      });
    });
  });
});