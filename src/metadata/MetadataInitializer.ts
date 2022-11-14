/***************************************
 * Title: MetadataInitializer
 * Description: TODO
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

export class MetadataInitializer {
    public static createLDESinLDPMetadata(lilURL: string, args?: {
        lilConfig?: { treePath: string, shape?: string, pageSize?: number }, //todo refactor, lilconfig already has date
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

    public static createVersionedLDESinLDPMetadata(lilURL: string, args?: {
        lilConfig?: { treePath: string, shape?: string, pageSize?: number, versionOfPath?: string },
        date?: Date
    }): IVersionedLDESinLDPMetadata {
        args = args ?? {}
        const lilMetadata = this.createLDESinLDPMetadata(lilURL, args)
        const versionOfPath = args.lilConfig ? args.lilConfig.versionOfPath : undefined;
        const timestampPath = args.lilConfig ? args.lilConfig.treePath : undefined;

        return new VersionedLDESinLDPMetadata(lilMetadata.eventStreamIdentifier, lilMetadata.view, lilMetadata.inbox, {
            timestampPath,
            versionOfPath
        }, lilMetadata.shape)
    }

    public static createRelation(nodeURL: string, path?: string, date?: Date): IRelation {
        date = date ?? new Date()
        path = path ?? DCT.created

        return new GreaterThanOrEqualToRelation(nodeURL, path, date.toISOString())
    }

    protected static createViewDescription(eventStreamIdentifier: string, rootNodeIdentifier: string, pageSize?: number, path?: string): ViewDescription {
        path = path ?? DCT.created

        const bucketizeStrategy = new BucketizeStrategy(`${rootNodeIdentifier}#BucketizeStrategy`, LDES.timestampFragmentation, path, pageSize)
        const lilClient = new LDESinLDPClient(`${rootNodeIdentifier}#LDESinLDPClient`, bucketizeStrategy)
        return new ViewDescription(`${rootNodeIdentifier}#ViewDescription`, lilClient, eventStreamIdentifier, rootNodeIdentifier)
    }
}
