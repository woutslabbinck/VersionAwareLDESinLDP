# Extra information

## Contributing

Via Pull requests, they get reviewed and if the tests pass and the code looks good it gets merged.

## Testing

### Test script explained

When `npm run test` is executed, `jest` is run.
First a [global-setup](../test/global-setup.ts) is run that executes the following steps:

1. A CSS server configured without an IDP is started.
2. A CSS server configured with an Identity Provider (IDP) is started.
3. A test account is created with following credentials :
   * email: `test@mail.com`
   * password: `test`
4. All the tests are run

### Running isolated tests

Run the individual test.
Example:
```shell
jest test/unit/versionawarelil/VersionAwareLDESinLDP.test.tsc
```

## Release checklist

- [ ] bump componentsjs version to the next version
- [ ] update documentation (when needed)
- [ ] run tests: `npm run test` (all must be successful)
- [ ] publish on npm: `npm run publish`
- [ ] publish on github
