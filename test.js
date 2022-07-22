async function f() {

    const {VersionAwareLDESinLDP, SolidCommunication, LDESinLDP} = require('./dist/Index.js');
    const {login, isLoggedin, getSession} = require('./dist/util/Login')
    const validatedOptions = {
        applicationName: "LDES-orchestrator",
        registrationType: "dynamic",
        // solidIdentityProvider: "http://localhost:3012"
        solidIdentityProvider: "https://solidcommunity.net"
    };
    // const test = async (s) => {
    // const url = 'https://lars-vc.solidcommunity.net/'

    login(validatedOptions);
    await isLoggedin(); // code that checks whether you are already logged in
    const session = await getSession();

    // const url = 'http://localhost:3012/'
    const url = "https://solidcommunity.net/"
    const ldesinldpIdentifier = `${url}public/testtt/`; // Base URL of the LDES in LDP 
    const communication = new SolidCommunication(session);
    const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
    const versionAware = new VersionAwareLDESinLDP(ldesinldp);

    await versionAware.initialise(ldesinldpIdentifier);

    const {Store, DataFactory} = require("n3");
    const namedNode = DataFactory.namedNode;
    const literal = DataFactory.literal;
    const store = new Store();
    const versionID = '#resource'; // could also be a full IRI e.g. http://example.org/resource1v1 
    const materializedID = 'http://example.org/resource1';
    store.addQuad(namedNode(versionID), namedNode('http://purl.org/dc/terms/title'), literal('Title'));
    await versionAware.create(materializedID, store, versionID);
    // }
    // await getSession(validatedOptions, test);
    // const url = 'https://lars-vc.solidcommunity.net/'
    // const url = 'http://localhost:3000/'
    // const ldesinldpIdentifier = `${url}private/t/`; // Base URL of the LDES in LDP 
    // const communication = new LDPCommunication({
    //     user_mail: "test@mail.com",
    //     user_password: "test",
    //     podurl: url
    // });
    // const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
    // const versionAware = new VersionAwareLDESinLDP(ldesinldp);

    // await versionAware.initialise(ldesinldpIdentifier);

    // const {Store, DataFactory} = require("n3");
    // const namedNode = DataFactory.namedNode;
    // const literal = DataFactory.literal;
    // const store = new Store();
    // const versionID = '#resource'; // could also be a full IRI e.g. http://example.org/resource1v1 
    // const materializedID = 'http://example.org/resource1';
    // store.addQuad(namedNode(versionID), namedNode('http://purl.org/dc/terms/title'), literal('Title'));
    // await versionAware.create(materializedID, store, versionID);
}
f()
