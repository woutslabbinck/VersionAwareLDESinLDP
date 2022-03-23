/***************************************
 * Title: runner
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ComponentsManager} from 'componentsjs';
import * as Path from "path";
import {ILDESinLDP} from "./ldesinldp/ILDESinLDP";
import {storeToString, turtleStringToStore} from "./util/Conversion";
import {DataFactory, Store} from "n3";

const memberString = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:  <http://example.org/> .
@prefix : <> .

<#resource> dct:isVersionOf ex:resource1.
<#resource> dct:issued "2021-12-15T10:00:00.000Z"^^xsd:dateTime.
<#resource> dct:title "First version of the title".
`
export async function run() {
    console.log(Path.join(__dirname, '../'))
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            logLevel: 'info'
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/default.json'));

    // todo: make base LDES in LDP configurable from CLI
    const baseIdentifier = "http://localhost:3123"

    const variables: Record<string, unknown> = {
        "urn:ldesinldp:variable:ldesinldpIdentifier": baseIdentifier
    }
    const ldesinldp = await manager.instantiate('urn:@treecg/versionawareldesinldp:ldesinldp', {variables: variables}) as ILDESinLDP;
    console.log(storeToString(await ldesinldp.read('https://tree.linkeddatafragments.org/announcements/root.ttl')))
}

export async function initiateLDESinLDP(baseIdentifier: string) {
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            logLevel: 'info'
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/default.json'));

    const variables: Record<string, unknown> = {
        "urn:ldesinldp:variable:ldesinldpIdentifier": baseIdentifier
    }
    const ldesinldp = await manager.instantiate('urn:@treecg/versionawareldesinldp:ldesinldp', {variables: variables}) as ILDESinLDP;
    // const baseContainer = await ldesinldp.read(baseIdentifier)
    // if (!baseContainer) {
        await ldesinldp.initialise({
            LDESinLDPIdentifier: `${baseIdentifier}`,
            treePath: "http://purl.org/dc/terms/created"
        })
    // }
    // create the a resource in the ldes
    await ldesinldp.create(await turtleStringToStore(memberString))

    //read the metadata
    await ldesinldp.readMetadata()
}
