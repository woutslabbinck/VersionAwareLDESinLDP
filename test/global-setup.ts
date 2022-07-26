import {initAuth, isRunning, runSolid, runAuthSolid, createTestAcc} from "./util/solidHelper";

async function start(): Promise<void> {
    // start server and wait till it is running + login and wait till that has succeeded
    await runSolid();
    // await runAuthSolid();
    // await createTestAcc();
    await initAuth();
    await isRunning();
}


module.exports = async (): Promise<void> => {
    try {
        await start();
    } catch (e) {
        console.log('Setting up test environment has failed.');
        console.log(e);
    }
};
