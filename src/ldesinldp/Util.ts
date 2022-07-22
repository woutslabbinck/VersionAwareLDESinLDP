/***************************************
 * Title: Util
 * Description: Utility functions helping the LDES in LDP protocol
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 23/03/2022
 *****************************************/
import {Communication} from "../ldp/Communication";
import {DCT, LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {DataFactory, Store} from "n3";
import {LDESinLDPConfig} from "./LDESinLDPConfig";
import {dateToLiteral} from "../util/TimestampUtil";
import namedNode = DataFactory.namedNode;

const parse = require('parse-link-header');

/**
 * Retrieves the location of the ldp:container to which can be written based on the ldp:inbox relation
 * @param resourceIdentifier the base identifier of the LDES in LDP
 * @param communication interface for HTTP requests
 * @returns {Promise<void>}
 */
export async function retrieveWriteLocation(resourceIdentifier: string, communication: Communication): Promise<string> {
    const response = await communication.head(resourceIdentifier);
    console.log(response);
    console.log(response.headers);

    const linkHeaders = parse(response.headers.get('link'));
    if (!linkHeaders) {
        throw new Error('No Link Header present.');
    }
    const inboxLink = linkHeaders[LDP.inbox];
    if (!inboxLink) {
        throw new Error('No http://www.w3.org/ns/ldp#inbox Link Header present.');
    }
    return inboxLink.url
}

/**
 * Adds a new versioned LDES, with a tree:view, (optionally) a shape and a first relation,
 * as defined in the LDES in LDP protocol to an N3 Store
 * @param store
 * @param config
 * @param date
 */
export function createVersionedEventStream(store: Store, config: LDESinLDPConfig, date: Date): void {
    const eventStreamIdentifier = config.LDESinLDPIdentifier + '#EventStream'
    const eventStreamNode = namedNode(eventStreamIdentifier)

    store.addQuad(eventStreamNode, namedNode(RDF.type), namedNode(LDES.EventStream))
    store.addQuad(eventStreamNode, namedNode(LDES.versionOfPath), namedNode(DCT.isVersionOf))
    store.addQuad(eventStreamNode, namedNode(LDES.timestampPath), namedNode(config.treePath))

    addShapeToEventStream(store, {eventStreamIdentifier, shape: config.shape});
    addRootNodetoEventStream(store, {
        eventStreamIdentifier: eventStreamIdentifier,
        nodeIdentifier: config.LDESinLDPIdentifier,
        treePath: config.treePath,
        date
    })
}

export function addShapeToEventStream(store: Store, config: {eventStreamIdentifier: string, shape?: string}): void {
    const eventStreamNode = namedNode(config.eventStreamIdentifier)

    if (config.shape) {
        store.addQuad(eventStreamNode, namedNode(TREE.shape), namedNode(config.shape))
    }
}

export interface LDESinLDPRootNodeConfig {
    date: Date
    nodeIdentifier: string
    treePath: string
    eventStreamIdentifier: string
}

/**
 * Adds a root tree:Node to the an LDES with a tree:GreaterThanOrEqualToRelation based on the date in a N3 Store
 * @param store
 * @param config
 */
export function addRootNodetoEventStream(store: Store, config: LDESinLDPRootNodeConfig): void {
    const eventStreamNode = namedNode(config.eventStreamIdentifier)
    const rootNode = namedNode(config.nodeIdentifier)

    store.addQuad(eventStreamNode, namedNode(TREE.view), rootNode)
    store.addQuad(rootNode, namedNode(RDF.type), namedNode(TREE.Node))
    addRelationToNode(store, {
        date: config.date,
        nodeIdentifier: config.nodeIdentifier,
        treePath: config.treePath
    })
}

export interface LDESinLDPTreeRelationConfig {
    date: Date
    nodeIdentifier: string
    treePath: string
}

/**
 * Adds a tree:GreaterThanOrEqualToRelation to a tree:Node in a N3 store
 * The tree:path is taken from the config
 * The tree:node of the new relation is based on the Date passed in the config.
 * The tree:value is also based on the date.
 *
 * @param store
 * @param config
 */
export function addRelationToNode(store: Store, config: LDESinLDPTreeRelationConfig): void {
    const relationNodeIdentifier = config.nodeIdentifier + config.date.valueOf() + '/'
    const node = namedNode(config.nodeIdentifier)
    const relationNode = store.createBlankNode();

    store.addQuad(node, namedNode(TREE.relation), relationNode)

    // add relation
    store.addQuad(relationNode, namedNode(RDF.type), namedNode(TREE.GreaterThanOrEqualToRelation));
    store.addQuad(relationNode, namedNode(TREE.node), namedNode(relationNodeIdentifier));
    store.addQuad(relationNode, namedNode(TREE.path), namedNode(config.treePath));
    store.addQuad(relationNode, namedNode(TREE.value), dateToLiteral(config.date));
}

export async function createContainer(resourceIdentifier: string, communication: Communication): Promise<void> {
    // Note: maybe check identifier?
    const response = await communication.put(resourceIdentifier)
    console.log(response);

    if (response.status !== 201) {
        throw Error(`The container ${resourceIdentifier} was not created | status code: ${response.status}`)
    }
    console.log(`LDP Container created: ${response.url}`)
}

export function sleep(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
