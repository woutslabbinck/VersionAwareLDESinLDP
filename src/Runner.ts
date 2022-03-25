/***************************************
 * Title: runner
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ComponentsManager} from 'componentsjs';
import * as Path from "path";
import {ILDESinLDP} from "./ldesinldp/ILDESinLDP";
import {memberStreamtoStore, storeToString} from "./util/Conversion";
import {VersionAwareLDESinLDP} from "./versionawarelil/VersionAwareLDESinLDP";
import {DataFactory, Store} from "n3";
import namedNode = DataFactory.namedNode;
import {DCT} from "./util/Vocabularies";
import literal = DataFactory.literal;

const currentDate = new Date()
const memberString = `
@prefix dct: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:  <http://example.org/> .
@prefix : <> .

<#resource> dct:isVersionOf ex:resource2.
<#resource> dct:created "${currentDate.toISOString()}"^^xsd:dateTime.
<#resource> dct:title "Title at ${currentDate.toLocaleString()}".
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
    const baseContainer = await ldesinldp.read(baseIdentifier)
    if (!baseContainer) {
        await ldesinldp.initialise({
            LDESinLDPIdentifier: `${baseIdentifier}`,
            treePath: "http://purl.org/dc/terms/created"
        })
    }
    // create the a resource in the ldes
    // await ldesinldp.create(await turtleStringToStore(memberString))

    // read the metadata
    // await ldesinldp.readMetadata()
    const stream = await ldesinldp.readAllMembers()
    const streamAsStore = await memberStreamtoStore(stream)
    console.log(storeToString(streamAsStore))
}

export async function instantiateVersionAwareLDESinLDP(baseIdentifier: string): Promise<VersionAwareLDESinLDP> {
    const manager = await ComponentsManager.build(
        {
            mainModulePath: Path.join(__dirname, '../'), // Path to your npm package's root
            logLevel: 'info'
        }
    );
    await manager.configRegistry.register(Path.join(__dirname, '../', 'config/attemptversionaware.json'));

    const variables: Record<string, unknown> = {
        "urn:ldesinldp:variable:ldesinldpIdentifier": baseIdentifier
    }
    return await manager.instantiate('urn:@treecg/versionawareldesinldp:versionawareldesinldp', {variables: variables}) as VersionAwareLDESinLDP
}

export async function readResource(baseIdentifier?: string, resourceIdentifier?: string) {
    baseIdentifier = baseIdentifier ? baseIdentifier : "http://localhost:3123/ldesinldp/"
    resourceIdentifier = resourceIdentifier ? resourceIdentifier : 'http://example.org/resource1'

    const vAwareLDESinLDP = await instantiateVersionAwareLDESinLDP(baseIdentifier)
    const resource = await vAwareLDESinLDP.read(resourceIdentifier)
    console.log(storeToString(resource))
}

export async function readContainer(baseIdentifier?: string) {
    baseIdentifier = baseIdentifier ? baseIdentifier : "http://localhost:3123/ldesinldp/"
    const vAwareLDESinLDP = await instantiateVersionAwareLDESinLDP(baseIdentifier)
    const container = await vAwareLDESinLDP.read(baseIdentifier)
    console.log(storeToString(container))
}

export async function createResource(baseIdentifier?: string, resourceIdentifier?: string) {
    baseIdentifier = baseIdentifier ? baseIdentifier : "http://localhost:3123/ldesinldp/"
    resourceIdentifier = resourceIdentifier ? resourceIdentifier : 'http://example.org/resource3'
    const vAwareLDESinLDP = await instantiateVersionAwareLDESinLDP(baseIdentifier)

    const store = new Store()
    // Note: it is good to have this one relative
    const versionSpecificResourceIdentifier = "#resource"
    store.addQuad(namedNode(versionSpecificResourceIdentifier), namedNode(DCT.title), literal("Some title created at: " + currentDate.toLocaleString()))
    await vAwareLDESinLDP.create(resourceIdentifier, store, versionSpecificResourceIdentifier)
}

export async function deleteResource(baseIdentifier: string, resourceIdentifier: string) {
    const vAwareLDESinLDP = await instantiateVersionAwareLDESinLDP(baseIdentifier)
    await vAwareLDESinLDP.delete(resourceIdentifier)
}
