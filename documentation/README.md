# Extra information

## Contributing

Via Pull requests, they get reviewed and if the tests pass and the code looks good it gets merged.

## Testing

### Test script explained

When `npm run test` is executed, a [script](../run_tests.sh) is run that executes the following steps:
1. A CSS server configured with an Identity Provider (IDP) is started.
2. A test account is created with following credentials :
   * email: `test@mail.com`
   * password: `test`
3. A link is provided such that you can log into the browser with those credentials
4. All the tests are run

### Running isolated tests

#### Without authentication

Run the individual test.
Example:
```shell
jest test/unit/versionawarelil/VersionAwareLDESinLDP.test.tsc
```

#### With authentication

Here a CSS server with IDP is required

1. Set up a CSS with IDP on port 3002: `npx @solid/community-server -p 3002`
2. Create a test account: `curl 'http://localhost:3002/setup' -X POST -H 'content-type: application/json' -H 'Origin: http://localhost:3002' --data-raw '{"registration":"on","createWebId":"on","webId":"","register":"on","createPod":"on","rootPod":"on","podName":"","email":"test@mail.com","password":"test","confirmPassword":"test"}'`
3. Run the individual test e.g.: `jest test/unit/communication/SolidCommunication.test.ts`
 
When this server is set up, all tests can be run now by using the command `jest`.
A consequence of this server running is that `npm run test` now is not possible anymore until the CSS one is killed.

## Release checklist

- [ ] bump componentsjs version to the next version
- [ ] update documentation (when needed)
- [ ] run tests: `npm run test` (all must be successful)
- [ ] publish on npm: `npm run publish`
- [ ] publish on github
