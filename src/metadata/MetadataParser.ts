/***************************************
 * Title: MetadataParser
 * Description: A class that parses metadata for an LDES in LDP or a versioned LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {Literal, Store} from "n3";
import {ILDESinLDPMetadata, LDESinLDPMetadata} from "./LDESinLDPMetadata";
import {DCAT, LDES, LDP, RDF, TREE, XSD} from "../util/Vocabularies";
import {
    IBucketizeStrategy,
    IDurationAgoPolicy,
    ILatestVersionSubset,
    IRelation,
    IRetentionPolicy,
    IViewDescription
} from "./util/Interfaces";
import {
    BucketizeStrategy,
    DurationAgoPolicy,
    GreaterThanOrEqualToRelation,
    LatestVersionSubset,
    LDESinLDPClient,
    Node,
    ViewDescription
} from "./util/Components";
import {IVersionedLDESinLDPMetadata, VersionedLDESinLDPMetadata} from "./VersionedLDESinLDPMetadata";
import * as Rdf from "@rdfjs/types";
import {Logger} from "../logging/Logger";
import {AbstractMetadataParser} from "@treecg/ldes-snapshot";

/**
 * The {@link MetadataParser} contains static methods to parse (versioned) LDES in LDP metadata (or parts from it).
 */
export class MetadataParser extends AbstractMetadataParser{
    /**
     * Parses an N3 Store to {@link ILDESinLDPMetadata}.
     * Parsing will throw an Error when the metadata graph can not be parsed as an LDES in LDP.
     *
     * Only Retention Policies that are in the View Description are parsed here.
     *
     * @param store the N3 store containing the LIL metadata.
     * @param eventStreamIdentifier (optional) URI of the Linked Data Event Stream Identifier.
     * @returns {ILDESinLDPMetadata}
     */
    public static extractLDESinLDPMetadata(store: Store, eventStreamIdentifier?: string): ILDESinLDPMetadata {
        eventStreamIdentifier = eventStreamIdentifier ?? this.parseLDESIdentifier(store)

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
        // assume view is the container URL
        const containerURL = rootNodeIdentifier
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
     * @param store the N3 store containing the versioned LIL metadata.
     * @param eventStreamIdentifier (optional) URI of the Linked Data Event Stream Identifier.
     * @returns {IVersionedLDESinLDPMetadata}
     */
    public static extractVersionedLDESinLDPMetadata(store: Store, eventStreamIdentifier?: string): IVersionedLDESinLDPMetadata {
        const lilMetadata = this.extractLDESinLDPMetadata(store, eventStreamIdentifier)
        eventStreamIdentifier = lilMetadata.eventStreamIdentifier
        const versionOfPath = this.parseVersionOfPath(store, eventStreamIdentifier);
        const timestampPath = this.parseTimestampPath(store, eventStreamIdentifier);

        return new VersionedLDESinLDPMetadata(eventStreamIdentifier, lilMetadata.view, lilMetadata.inbox, {
            timestampPath,
            versionOfPath
        }, lilMetadata.shape)
    }

    /**
     * Parses a selection of an N3 Store to a {@link GreaterThanOrEqualToRelation}.
     *
     * @param store An N3 Store.
     * @param relationNode The subject of the Relation in the store.
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
     * @param store An N3 Store.
     * @param viewDescriptionNode The subject of the View Description in the store.
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

        const retentionPolicyNodes = store.getObjects(viewDescriptionNode, LDES.retentionPolicy, null)
        const retentionPolicies = this.parseRetentionPolicies(store, retentionPolicyNodes)

        const bucketizeStrategy = this.parseBucketizeStrategy(store, bucketizers[0])

        const lilClient = new LDESinLDPClient(managedByNode.value, bucketizeStrategy)

        return new ViewDescription(viewDescriptionNode.value, lilClient, eventStreamIdentifier, rootNodeIdentifier, retentionPolicies)
    }

    protected static parseBucketizeStrategy(store: Store, bucketizeStrategyNode: Rdf.Term): IBucketizeStrategy {
        const bucketTypes = store.getObjects(bucketizeStrategyNode, LDES.bucketType, null)
        const treePaths = store.getObjects(bucketizeStrategyNode, TREE.path, null)

        if (bucketTypes.length !== 1) {
            throw new Error(`Could not parse bucketizer in view description as the expected amount of bucket types is 1 | received: ${bucketTypes.length}`)
        }
        if (treePaths.length !== 1) {
            throw new Error(`Could not parse bucketizer in view description as the expected amount of paths is 1 | received: ${treePaths.length}`)
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

        return new BucketizeStrategy(bucketizeStrategyNode.value, bucketType, path, pageSize)
    }

    /**
     * Parses a selection of an N3 Store to a collection of {@link IRetentionPolicy}.
     *
     * @param store An N3 Store.
     * @param retentionPolicyNodes A list of retention policies that are present in the View Description.
     * @returns {IRetentionPolicy[]}
     */
    public static parseRetentionPolicies(store: Store, retentionPolicyNodes: Rdf.Term[]): IRetentionPolicy[] {
        const retentionPolicies: IRetentionPolicy[] = []

        retentionPolicyNodes.forEach(retentionPolicyNode => {
            let types = store.getObjects(retentionPolicyNode, RDF.type, null)
            const retentionPolicyType = types.length > 1 ? undefined : types[0]?.value

            switch (retentionPolicyType) {
                case LDES.DurationAgoPolicy:
                    retentionPolicies.push(this.parseDurationAgoPolicy(store, retentionPolicyNode))
                    break
                case LDES.LatestVersionSubset:
                    retentionPolicies.push(this.parseLatestVersionSubset(store, retentionPolicyNode))
                    break
                default:
                    let logger = new Logger(this)
                    logger.info(`Could not parse the retention policy for identifier ${retentionPolicyNode.value}.`)
            }
        })

        return retentionPolicies
    }

    /**
     * Parses a selection of an N3 Store to a {@link IDurationAgoPolicy}.
     *
     * @param store An N3 Store.
     * @param durationAgoPolicyNode The subject of a DurationAgoPolicy in the store.
     * @returns {IDurationAgoPolicy}
     */
    private static parseDurationAgoPolicy(store: Store, durationAgoPolicyNode: Rdf.Term): IDurationAgoPolicy {
        const durations = store.getObjects(durationAgoPolicyNode, TREE.value, null)
        if (durations.length !== 1) {
            throw new Error(`Could not parse the value for Duration Ago Policy (${durationAgoPolicyNode.value}) as the expected amount of values is 1 | received: ${durations.length}`)
        }
        const duration = durations[0] as Literal
        if (duration.datatype.value !== XSD.duration) {
            throw new Error(`Could not parse the value for Duration Ago Policy (${durationAgoPolicyNode.value}) as the expected data type is ${XSD.duration}`)
        }
        return new DurationAgoPolicy(durationAgoPolicyNode.value, duration.value)
    }

    /**
     * Parses a selection of an N3 Store to a {@link ILatestVersionSubset}.
     *
     * @param store An N3 Store.
     * @param latestVersionSubsetNode The subject of a LatestVersionSubset policy in the store.
     * @returns {ILatestVersionSubset}
     */
    private static parseLatestVersionSubset(store: Store, latestVersionSubsetNode: Rdf.Term): ILatestVersionSubset {
        const amountValues = store.getObjects(latestVersionSubsetNode, LDES.amount, null)
        if (amountValues.length !== 1) {
            throw new Error(`Could not parse the amount for Latest Version Subset (${latestVersionSubsetNode.value}) as the expected amount of amount is 1 | received: ${amountValues.length}`)
        }
        const amount = parseInt(amountValues[0].value, 10)
        if (isNaN(amount)) {
            throw Error("Could not parse amount in Latest Version Subset as it is not a number.")
        }
        let timestampPath
        let versionOfPath
        try {
            timestampPath = this.parseTimestampPath(store, latestVersionSubsetNode.value)
            versionOfPath = this.parseVersionOfPath(store, latestVersionSubsetNode.value)
        } catch (e) {

        }
        return new LatestVersionSubset(latestVersionSubsetNode.value, amount, {timestampPath, versionOfPath})
    }
}
