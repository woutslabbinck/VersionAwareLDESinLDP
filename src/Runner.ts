/***************************************
 * Title: Runner
 * Description: A runner for instantiating a version aware LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ComponentsManager} from 'componentsjs';
import * as Path from "path";
import {VersionAwareLDESinLDP} from "./versionawarelil/VersionAwareLDESinLDP";

/**
 * Instantiates a VersionAwareLDESinLDP object
 * @param baseLDESinLDPIdentifier the base LDES in LDP URL
 * @returns {Promise<VersionAwareLDESinLDP>}
 */
export async function versionAwareLDESinLDP(baseLDESinLDPIdentifier: string): Promise<VersionAwareLDESinLDP> {
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            logLevel: 'info'
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/attemptversionaware.json'));

    const variables: Record<string, unknown> = {
        "urn:ldesinldp:variable:ldesinldpIdentifier": baseLDESinLDPIdentifier
    }
    return await manager.instantiate('urn:@treecg/versionawareldesinldp:versionawareldesinldp', {variables: variables}) as VersionAwareLDESinLDP
}
