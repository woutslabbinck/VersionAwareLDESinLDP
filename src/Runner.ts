/***************************************
 * Title: runner
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ComponentsManager} from 'componentsjs';
import * as Path from "path";
import {Communication} from "./ldp/Communication";
import {ILDESinLDP} from "./ldesinldp/ILDESinLDP";

async function run() {
    console.log(Path.join(__dirname, '../'))
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            logLevel: 'info'
            // mainModulePath: __dirname, // Path to your npm package's root
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/default.json'));

    // todo: make base LDES in LDP configurable from CLI
    const baseIdentifier = "http://localhost:3123"

    const variables: Record<string, unknown> = {
        "urn:ldesinldp:variable:ldesinldpIdentifier": baseIdentifier
    }
    const myInstance = await manager.instantiate('urn:@treecg/versionawareldesinldp:ldesinldp', {variables: variables});
    return myInstance
}

export async function other() {
    const ldesinldp: ILDESinLDP = await run() as ILDESinLDP
    const response = await ldesinldp.read('https://tree.linkeddatafragments.org/announcements/')
}
