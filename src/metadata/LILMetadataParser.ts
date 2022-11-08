/***************************************
 * Title: LILMetadataParser
 * Description: TODO
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

export class LILMetadataParser {
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
        let viewDescription: IViewDescription | undefined // viewDescription is not Recommended
        if (store.getObjects(rootNodeIdentifier, TREE.viewDescription, null).length === 1) {
            const viewDescriptionNode = store.getObjects(rootNodeIdentifier, TREE.viewDescription, null)[0]
            viewDescription = this.parseViewDescription(store, viewDescriptionNode)

            if (viewDescription.endpointURL !== rootNodeIdentifier) {
                throw Error(`dcatendpointURL (${viewDescription.endpointURL}) does not match the view Identifier of the LDES in LDP: ${rootNodeIdentifier}`)
            }
            if (viewDescription.servesDataset !== eventStreamIdentifier) {
                throw Error(`dcatendpointURL (${viewDescription.servesDataset}) does not match the view Identifier of the LDES in LDP: ${eventStreamIdentifier}`)
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

    public static parseRelation(store: Store, relationNode: Rdf.Term): IRelation {
        // TODO error handling

        const node = store.getObjects(relationNode, TREE.node, null)[0].value
        const path = store.getObjects(relationNode, TREE.path, null)[0].value
        const value = store.getObjects(relationNode, TREE.value, null)[0].value
        return new GreaterThanOrEqualToRelation(node, path, value)
    }

    public static parseViewDescription(store: Store, viewDescriptionNode: Rdf.Term): IViewDescription {
        // TODO error handling

        const eventStreamIdentifier = store.getObjects(viewDescriptionNode, DCAT.servesDataset, null)[0].value
        const rootNodeIdentifier = store.getObjects(viewDescriptionNode, DCAT.endpointURL, null)[0].value

        const managedByNode = store.getObjects(viewDescriptionNode, LDES.managedBy, null)[0]

        const bucketizeStrategyNode = store.getObjects(managedByNode, LDES.bucketizeStrategy, null)[0]

        const bucketType = store.getObjects(bucketizeStrategyNode, LDES.bucketType, null)[0].value
        const path = store.getObjects(bucketizeStrategyNode, TREE.path, null)[0].value // TODO: must be same as all tree paths!!
        let pageSize: number | undefined
        if (store.getObjects(bucketizeStrategyNode, LDES.pageSize, null).length === 1) {
            const pageSizeLiteral = (store.getObjects(bucketizeStrategyNode, LDES.pageSize, null)[0] as Literal)
            pageSize = parseInt(pageSizeLiteral.value, 10)
        }

        const bucketizeStrategy = new BucketizeStrategy(bucketizeStrategyNode.value, bucketType, path, pageSize)

        const lilClient = new LDESinLDPClient(managedByNode.value, bucketizeStrategy)

        return new ViewDescription(viewDescriptionNode.value, lilClient, eventStreamIdentifier, rootNodeIdentifier)
    }
}
