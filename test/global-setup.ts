import {registerAccount, runSolidPrivate, runSolidPublic} from "./util/solidHelper";

async function start(): Promise<void> {
    // start server without setup (and public ACL) and wait till it is running
    await runSolidPublic();
    // start server with setup
    await runSolidPrivate();
    // register dummy account
    await registerAccount();
}


module.exports = async (): Promise<void> => {
    try {
        await start();
    } catch (e) {
        console.log('Setting up test environment has failed.');
        console.log(e);
    }
};
