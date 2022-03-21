/***************************************
 * Title: runner
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ComponentsManager} from 'componentsjs';
import * as Path from "path";
import {Communication} from "./ldp/Communication";

async function run() {
    console.log(Path.join(__dirname, '../'))
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            // mainModulePath: __dirname, // Path to your npm package's root
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/default.json'));
    // await manager.configRegistry.register('files-awarelil:config/default.json');
    const myInstance = await manager.instantiate('urn:@treecg/versionawareldesinldp:communication');
    return myInstance
}

async function other() {
    const communication: Communication = await run() as Communication
    const response = await communication.get('https://woutslabbinck.github.io/LDESinLDP/')
    console.log(response.status)
}

other()