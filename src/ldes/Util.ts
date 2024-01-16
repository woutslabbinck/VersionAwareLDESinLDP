/***************************************
 * Title: Util
 * Description: Utility functions helping the LDES in LDP protocol
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 23/03/2022
 *****************************************/
import {Communication} from "../ldp/Communication";
import {LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {DataFactory, Store} from "n3";
import {LDESConfig} from "./LDESConfig";
import {dateToLiteral} from "../util/TimestampUtil";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {ILDESinLDPMetadata} from "../metadata/LDESinLDPMetadata";
import {GreaterThanOrEqualToRelation} from "../metadata/util/Components";
import {patchSparqlUpdateInsert} from "../util/PatchUtil";
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
export function createVersionedEventStream(store: Store, config: LDESConfig, date: Date): void {
    const eventStreamIdentifier = config.LDESinLDPIdentifier + '#EventStream'
    const eventStreamNode = namedNode(eventStreamIdentifier)

    store.addQuad(eventStreamNode, namedNode(RDF.type), namedNode(LDES.EventStream))
    store.addQuad(eventStreamNode, namedNode(LDES.versionOfPath), namedNode(config.versionOfPath))
    store.addQuad(eventStreamNode, namedNode(LDES.timestampPath), namedNode(config.treePath))

    addShapeToEventStream(store, {eventStreamIdentifier, shape: config.shape});
    addRootNodeToEventStream(store, {
        eventStreamIdentifier: eventStreamIdentifier,
        nodeIdentifier: config.LDESinLDPIdentifier,
        treePath: config.treePath,
        date
    })
}

export function addShapeToEventStream(store: Store, config: { eventStreamIdentifier: string, shape?: string }): void {
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
 * Adds a root tree:Node to an LDES with a tree:GreaterThanOrEqualToRelation based on the date in a N3 Store
 * @param store
 * @param config
 */
export function addRootNodeToEventStream(store: Store, config: LDESinLDPRootNodeConfig): void {
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
    /**
     * used for creating the identifier of the relation
     */
    date: Date
    /**
     * tree:node identifier
     */
    nodeIdentifier: string
    /**
     * tree:path, i.e. the shacl Property path
     */
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
    const relationNodeIdentifier = getRelationIdentifier(config.nodeIdentifier, config.date)
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
    if (!isContainerIdentifier(resourceIdentifier)) {
        throw Error(`Tried creating a container at URL ${resourceIdentifier}, however this is not a Container (due to slash semantics).`)
    }
    const response = await communication.put(resourceIdentifier)

    if (response.status !== 201) {
        throw Error(`The container ${resourceIdentifier} was not created | status code: ${response.status}`)
    }
    console.log(`LDP Container created: ${response.url}`)
}

export function getRelationIdentifier(ldesinLDPIdentifier: string, date: Date): string {
    return ldesinLDPIdentifier + date.getTime() + '/'
}

/**
 * extract members without containment triple
 * @param store
 * @param ldesIdentifier
 * @returns {Store<Quad, Quad, Quad, Quad>[]}
 */
export function extractMembers(store: Store, ldesIdentifier: string): Store[] {
    const memberSubjects = store.getObjects(ldesIdentifier, TREE.member, null)
    const members = memberSubjects.map(memberSubject => store.getQuads(memberSubject, null, null, null))

    // extract every member based on the subject
    const mainSubjects = new Set(memberSubjects.map(subj => subj.id));

    for (const member of members) {
        // to avoid issues with data referencing themselves in a circle,
        // duplicates are filtered out as well
        // the initial subject (there should only be one still) is added
        // as an initial to-be-ignored object
        const existingObjects = new Set<string>(member[0].subject.id);
        for (const quad of member) {
            if (existingObjects.has(quad.object.id)) {
                continue;
            }
            existingObjects.add(quad.object.id);
            // all quads with subjects equal to its object representation
            // gets added to this resource entry, so the original subjects'
            // data is completely present inside this single resource
            // this approach already works recursively, as push adds new elements
            // to the end, making them appear as subjects in further
            // iterations
            // quads having another main resource (that is not the current resource)
            // as object are getting filtered out as well, as they cannot be further
            // defined within this single resource
            member.push(
                ...store.getQuads(quad.object, null, null, null).filter((obj) => {
                    return obj.object.id === member[0].subject.id || !((mainSubjects as Set<string>).has(obj.object.id))
                })
            );
        }
    }
    return members.map(member => new Store(member))
}

export function retrieveDateTimeFromInbox(ldesMetadata: ILDESinLDPMetadata): Date {
    const inboxURL = ldesMetadata.inbox

    for (const relation of ldesMetadata.view.relations) {
        if (relation.node === inboxURL) {
            return new Date(relation.value)
        }
    }
    throw new Error(`The inbox of the LDES in LDP (${inboxURL}) can not be found in any of the relations of the LDES Metadata.`)
}

/**
 * appends Relation metadata to an LDP container (`containerURL`).
 * The relation node comes from a newly created resource (`resourceURL`),
 * its date from the oldest member within that resource (`date`)
 * and the treePath from the metadata (`metadata`).
 *
 * @param args
 * @return {Promise<void>}
 */
export async function appendRelationToPage(args: {
    communication: Communication
    containerURL: string,
    date: Date,
    metadata: ILDESinLDPMetadata,
    resourceURL: string,
}): Promise<void> {
    const {communication, containerURL, date, metadata, resourceURL} = args
    metadata.view.relations = [] // should be a deep copy to be done properly
    const newRelation = new GreaterThanOrEqualToRelation(resourceURL, metadata.view.viewDescription!.managedBy.bucketizeStrategy.path, date.toISOString())
    metadata.view.relations.push(newRelation)
    const relationMetadata = metadata.getStore()
    relationMetadata.removeQuads(relationMetadata.getQuads(null, LDP.terms.inbox, null, null))
    await communication.patch(containerURL + '.meta', patchSparqlUpdateInsert(relationMetadata))
}
