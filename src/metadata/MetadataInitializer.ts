/***************************************
 * Title: MetadataInitializer
 * Description: A class that generates metadata for an LDES in LDP or a versioned LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {
    BucketizeStrategy,
    GreaterThanOrEqualToRelation,
    LDESinLDPClient,
    Node,
    ViewDescription
} from "./util/Components";
import {DCT, LDES} from "../util/Vocabularies";
import {getRelationIdentifier} from "../ldes/Util";
import {ILDESinLDPMetadata, LDESinLDPMetadata} from "./LDESinLDPMetadata";
import {IRelation} from "./util/Interfaces";
import {IVersionedLDESinLDPMetadata, VersionedLDESinLDPMetadata} from "./VersionedLDESinLDPMetadata";

/**
 * The {@link MetadataInitializer} contains static methods to generate metadata
 * for (parts of and) a complete (versioned) LDESs in LDP.
 */
export class MetadataInitializer {
    /**
     * Generates new LDES in LDP metadata following the {@link ILDESinLDPMetadata} Interface.
     * It will always create a View Description (which is an extension mentioned in the spec § 5.2. View Description).
     *
     * The metadata will either be generated with the LDES in LDP Identifier with a default `tree:path` property (dct:created).
     * Or can be configured based on the args.
     * Furthermore, when a date parameter in args is passed, the generated GTE relation will have this date as `tree:value`.
     *
     * @param lilURL the LDES in LDP identifier.
     * @param args parameters to persist in the metadata.
     * @returns {ILDESinLDPMetadata}
     */
    public static generateLDESinLDPMetadata(lilURL: string, args?: {
        lilConfig?: { treePath?: string, shape?: string, pageSize?: number },
        date?: Date
    }): ILDESinLDPMetadata {
        args = args ?? {}

        const date = args.date ?? new Date()

        const pageSize = args.lilConfig ? args.lilConfig.pageSize : undefined;
        const treePath = args.lilConfig ? args.lilConfig.treePath : undefined;
        const shape = args.lilConfig ? args.lilConfig.shape : undefined;

        const eventStreamIdentifier = `${lilURL}#EventStream`

        const relationIdentifier = getRelationIdentifier(lilURL, date)
        const relation = this.createRelation(relationIdentifier, treePath, date)
        const viewDescription = this.createViewDescription(eventStreamIdentifier, lilURL, pageSize, treePath)

        const node = new Node(lilURL, [relation], viewDescription)
        return new LDESinLDPMetadata(eventStreamIdentifier, node, relation.node, shape)
    }

    /**
     * Generates new versioned LDES in LDP metadata following the {@link IVersionedLDESinLDPMetadata} Interface.
     * It extends on the functionality of {@link generateLDESinLDPMetadata}.
     * It allows to define the properties of `ldes:versionOfPath` and `ldes:timestampPath` through respectively
     * versionOfPath and treePath.
     *
     * @param lilURL the LDES in LDP identifier.
     * @param args parameters to persist in the metadata.
     * @returns {IVersionedLDESinLDPMetadata}
     */
    public static generateVersionedLDESinLDPMetadata(lilURL: string, args?: {
        vlilConfig?: { treePath?: string, shape?: string, pageSize?: number, versionOfPath?: string },
        date?: Date
    }): IVersionedLDESinLDPMetadata {
        args = args ?? {}
        const lilMetadata = this.generateLDESinLDPMetadata(lilURL, args)
        const versionOfPath = args.vlilConfig ? args.vlilConfig.versionOfPath : undefined;
        const timestampPath = args.vlilConfig ? args.vlilConfig.treePath : undefined;

        return new VersionedLDESinLDPMetadata(lilMetadata.eventStreamIdentifier, lilMetadata.view, lilMetadata.inbox, {
            timestampPath,
            versionOfPath
        }, lilMetadata.shape)
    }

    /**
     * Generates a GreaterThanOrEqualTo (GTE) relation to point to a given `tree:Node`.
     *
     * @param nodeURL the URL to the tree:Node.
     * @param path the `tree:path` of the relation (default `dct:created`).
     * @param date the date that will be used as `tree:value` (default current Date).
     * @returns {GreaterThanOrEqualToRelation}
     */
    public static createRelation(nodeURL: string, path?: string, date?: Date): IRelation {
        date = date ?? new Date()
        path = path ?? DCT.created

        return new GreaterThanOrEqualToRelation(nodeURL, path, date.toISOString())
    }

    /**
     * Generates a View Description {@link IViewDescription} for an LDES in LDP View. (§ 5.2. View Description)
     * This description states that the view is managed by a client {@link ILDESinLDPClient} that follows the LDES in LDP protocol
     * following a specific {@link IBucketizeStrategy}.
     *
     * @param eventStreamIdentifier URI of the Event Stream.
     * @param rootNodeIdentifier URI of the view (the root node) of the Event Stream.
     * @param pageSize The number of members a given page can have.
     * @param path
     * @returns {ViewDescription}
     */
    protected static createViewDescription(eventStreamIdentifier: string, rootNodeIdentifier: string, pageSize?: number, path?: string): ViewDescription {
        path = path ?? DCT.created

        const bucketizeStrategy = new BucketizeStrategy(`${rootNodeIdentifier}#BucketizeStrategy`, LDES.timestampFragmentation, path, pageSize)
        const lilClient = new LDESinLDPClient(`${rootNodeIdentifier}#LDESinLDPClient`, bucketizeStrategy)
        return new ViewDescription(`${rootNodeIdentifier}#ViewDescription`, lilClient, eventStreamIdentifier, rootNodeIdentifier)
    }
}
