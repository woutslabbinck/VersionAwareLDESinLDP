/***************************************
 * Title: MetadataParser
 * Description: A class that parses metadata for an LDES in LDP or a versioned LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {Literal, Store} from "n3";
import {ILDESinLDPMetadata, LDESinLDPMetadata} from "./LDESinLDPMetadata";
import {DCAT, LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {IRelation, IViewDescription} from "./util/Interfaces";
import {
    BucketizeStrategy,
    GreaterThanOrEqualToRelation,
    LDESinLDPClient,
    Node,
    ViewDescription
} from "./util/Components";
import {IVersionedLDESinLDPMetadata, VersionedLDESinLDPMetadata} from "./VersionedLDESinLDPMetadata";
import * as Rdf from "@rdfjs/types";

/**
 * The {@link MetadataParser} contains static methods to parse (versioned) LDES in LDP metadata (or parts from it).
 */
export class MetadataParser {
    /**
     * Parses an N3 Store to {@link ILDESinLDPMetadata}.
     * Parsing will throw an Error when the metadata graph can not be parsed as an LDES in LDP.
     *
     * @param store the N3 store containing the LIL metadata
     * @returns {ILDESinLDPMetadata}
     */
    public static extractLDESinLDPMetadata(store: Store): ILDESinLDPMetadata {
        if (store.getSubjects(RDF.type, LDES.EventStream, null).length !== 1) {
            throw Error(`Expected only one Event Stream. ${store.getSubjects(RDF.type, LDES.EventStream, null).length} are present.`)
        }
        const eventStreamIdentifier = store.getSubjects(RDF.type, LDES.EventStream, null)[0].value

        if (store.getObjects(eventStreamIdentifier, TREE.view, null).length !== 1) {
            throw Error(`Expected only one view. ${store.getObjects(eventStreamIdentifier, TREE.view, null).length} are present.`)
        }

        const rootNodeIdentifier = store.getObjects(eventStreamIdentifier, TREE.view, null)[0].value

        const relationNodes = store.getObjects(rootNodeIdentifier, TREE.relation, null)
        const relations: IRelation[] = []

        for (const relationNode of relationNodes) {
            relations.push(this.parseRelation(store, relationNode))
        }
        let viewDescription: IViewDescription | undefined // viewDescription is recommended
        if (store.getObjects(rootNodeIdentifier, TREE.viewDescription, null).length === 1) {
            const viewDescriptionNode = store.getObjects(rootNodeIdentifier, TREE.viewDescription, null)[0]
            viewDescription = this.parseViewDescription(store, viewDescriptionNode)

            if (viewDescription.endpointURL !== rootNodeIdentifier) {
                throw Error(`dcatendpointURL (${viewDescription.endpointURL}) does not match the view Identifier of the LDES in LDP: ${rootNodeIdentifier}`)
            }
            if (viewDescription.servesDataset !== eventStreamIdentifier) {
                throw Error(`serves dataset property (${viewDescription.servesDataset}) does not match the EventStream Identifier of the LDES in LDP: ${eventStreamIdentifier}`)
            }

        }
        // remove hash
        const containerURL = eventStreamIdentifier.split('#')[0]
        if (store.getObjects(containerURL, LDP.inbox, null).length !== 1) {
            throw Error(`Expected only one inbox. ${store.getObjects(eventStreamIdentifier, LDP.inbox, null).length} are present.`)
        }
        const inboxIdentifier = store.getObjects(containerURL, LDP.inbox, null)[0].value

        const rootNode = new Node(rootNodeIdentifier, relations, viewDescription)
        return new LDESinLDPMetadata(eventStreamIdentifier, rootNode, inboxIdentifier)
    }

    /**
     * Parses an N3 Store to {@link IVersionedLDESinLDPMetadata}.
     * Parsing will throw an Error when the metadata graph can not be parsed as an LDES in LDP.
     *
     * @param store the N3 store containing the versioned LIL metadata
     * @returns {IVersionedLDESinLDPMetadata}
     */
    public static extractVersionedLDESinLDPMetadata(store: Store): IVersionedLDESinLDPMetadata {
        const lilMetadata = this.extractLDESinLDPMetadata(store)


        if (store.getObjects(lilMetadata.eventStreamIdentifier, LDES.versionOfPath, null).length !== 1) {
            throw Error(`Expected only one versionOfPath. ${store.getObjects(lilMetadata.eventStreamIdentifier, LDES.versionOfPath, null).length} are present.`)
        }

        if (store.getObjects(lilMetadata.eventStreamIdentifier, LDES.timestampPath, null).length !== 1) {
            throw Error(`Expected only one timestampPath. ${store.getObjects(lilMetadata.eventStreamIdentifier, LDES.timestampPath, null).length} are present.`)
        }

        const versionOfPath = store.getObjects(lilMetadata.eventStreamIdentifier, LDES.versionOfPath, null)[0].value
        const timestampPath = store.getObjects(lilMetadata.eventStreamIdentifier, LDES.timestampPath, null)[0].value
        return new VersionedLDESinLDPMetadata(lilMetadata.eventStreamIdentifier, lilMetadata.view, lilMetadata.inbox, {
            timestampPath,
            versionOfPath
        }, lilMetadata.shape)
    }

    /**
     * Parses a selection of an N3 Store to a {@link GreaterThanOrEqualToRelation}
     *
     * @param store An N3 Store
     * @param relationNode The subject of the Relation in the store
     * @returns {GreaterThanOrEqualToRelation}
     */
    public static parseRelation(store: Store, relationNode: Rdf.Term): GreaterThanOrEqualToRelation {
        const types = store.getQuads(relationNode, RDF.type, null, null)
        const nodes = store.getQuads(relationNode, TREE.node, null, null)
        const treePaths = store.getQuads(relationNode, TREE.path, null, null)
        const values = store.getQuads(relationNode, TREE.value, null, null)
        if (nodes.length !== 1) {
            throw new Error(`Could not parse relation as the expected amount of tree nodes is 1 | received: ${nodes.length}`)
        }
        if (treePaths.length !== 1) {
            throw new Error(`Could not parse relation as the expected amount of tree paths is 1 | received: ${treePaths.length}`)
        }
        if (values.length !== 1) {
            throw new Error(`Could not parse relation as the expected amount of tree values is 1 | received: ${values.length}`)
        }
        if (types.length !== 1) {
            throw new Error(`Could not parse relation as the expected amount of types is 1 | received: ${values.length}`)
        }
        if (types[0].object.value !== TREE.GreaterThanOrEqualToRelation) {
            throw new Error(`LDES in LDP expects GreaterThanOrEqualToRelation as type } received: ${types[0].object.value}`)
        }

        const node = nodes[0].object.value
        const path = treePaths[0].object.value
        const value = values[0].object.value

        return new GreaterThanOrEqualToRelation(node, path, value)
    }

    /**
     * Parses a selection of an N3 Store to a {@link IViewDescription}.
     *
     * @param store An N3 Store
     * @param viewDescriptionNode The subject of the View Description in the store
     * @returns {IViewDescription}
     */
    public static parseViewDescription(store: Store, viewDescriptionNode: Rdf.Term): IViewDescription {
        const esIds = store.getObjects(viewDescriptionNode, DCAT.servesDataset, null)
        const rootNodeIds = store.getObjects(viewDescriptionNode, DCAT.endpointURL, null)
        const managedByIds = store.getObjects(viewDescriptionNode, LDES.managedBy, null)

        if (esIds.length !== 1) {
            throw new Error(`Could not parse view description as the expected amount of serve dataset identifiers is 1 | received: ${esIds.length}`)
        }
        if (rootNodeIds.length !== 1) {
            throw new Error(`Could not parse view description as the expected amount of endpoint URLs is 1 | received: ${rootNodeIds.length}`)
        }
        if (managedByIds.length !== 1) {
            throw new Error(`Could not parse view description as the expected amount of managed by identifiers is 1 | received: ${managedByIds.length}`)
        }

        const eventStreamIdentifier = esIds[0].value
        const rootNodeIdentifier = rootNodeIds[0].value

        const managedByNode = managedByIds[0]

        const bucketizers = store.getObjects(managedByNode, LDES.bucketizeStrategy, null)
        if (bucketizers.length !== 1) {
            throw new Error(`Could not parse view description as the expected amount of bucketizers is 1 | received: ${bucketizers.length}`)
        }

        const bucketizeStrategyNode = bucketizers[0]

        const bucketTypes = store.getObjects(bucketizeStrategyNode, LDES.bucketType, null)
        const treePaths = store.getObjects(bucketizeStrategyNode, TREE.path, null)

        if (bucketTypes.length !== 1) {
            throw new Error(`Could not parse bucketizer in view description as the expected amount of bucket types is 1 | received: ${bucketTypes.length}`)
        }
        if (treePaths.length !== 1) {
            throw new Error(`Could not parse bucketizer in view description as the expected amount of pathss is 1 | received: ${treePaths.length}`)
        }
        const bucketType = bucketTypes[0].value
        const path = treePaths[0].value // NOTE: must be same as all tree paths in each Relation!!

        let pageSize: number | undefined
        if (store.getObjects(bucketizeStrategyNode, LDES.pageSize, null).length === 1) {
            const pageSizeLiteral = store.getObjects(bucketizeStrategyNode, LDES.pageSize, null)[0] as Literal
            pageSize = parseInt(pageSizeLiteral.value, 10)
            if (isNaN(pageSize)) {
                throw Error("Could not parse bucketizer in view description as the page size is not a number.")
            }
        }

        const bucketizeStrategy = new BucketizeStrategy(bucketizeStrategyNode.value, bucketType, path, pageSize)

        const lilClient = new LDESinLDPClient(managedByNode.value, bucketizeStrategy)

        return new ViewDescription(viewDescriptionNode.value, lilClient, eventStreamIdentifier, rootNodeIdentifier)
    }
}
