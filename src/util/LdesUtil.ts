/***************************************
 * Title: LdesUtil
 * Description: Utility function for LDESes
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 29/03/2022
 *****************************************/
import {DataFactory, Store} from "n3";
import {extractSnapshotOptions} from "@treecg/ldes-snapshot/dist/src/util/SnapshotUtil";
import {DCAT, DCT, LDES, LDP, RDF, TREE} from "./Vocabularies";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";
import {storeToString} from "./Conversion";
import {dateToLiteral} from "./TimestampUtil";
import {getRelationIdentifier} from "../ldes/Util";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import * as path from "path";

export interface Relation {
    type: string
    value: string
    node: string
    path: string // should be SHACLPath
}

export interface IRelation {
    type: string
    value: string
    node: string
    path: string // should be SHACLPath

    getStore: () => Store
}

// TODO make classes for everything that can also create a graph
//  internally only save properties!!!
export interface ILDESinLDPMetadata {
    eventStreamIdentifier: string
    view: INode
    inbox: string
    shape?: string

    rootNodeIdentifier: () => string // view identifier TODO: GET method ?
    getStore: () => Store
    fragmentSize: () => number // TODO: GET method -> Infinity if not present
}

export interface IVersionedLDESinLDPMetadata extends ILDESinLDPMetadata {
    timestampPath: string
    versionOfPath: string
    deletedType: string
}

export interface INode {
    id: string
    relations: Relation[]
    viewDescription: IViewDescription

    getStore: () => Store
}

export interface IViewDescription {
    id: string
    managedBy: ILDESinLDPClient
    servesDataset: string // LDESinLDPMetadata.eventStreamIdentifier
    endpointURL: string // Node.id

    getStore: () => Store
}

export interface ILDESinLDPClient {
    id: string
    bucketizeStrategy: IBucketizeStrategy

    getStore: () => Store
}

export interface IBucketizeStrategy {
    id: string
    bucketType: string
    path: string // should be SHACLPath
    pageSize?: number

    getStore: () => Store
}


class LDESinLDPMetadata implements ILDESinLDPMetadata {
    private _eventStreamIdentifier: string
    private _view: INode
    private _inbox: string
    private _shape: string | undefined

    constructor(eventStreamIdentifier: string, view: INode, inbox: string, shape?: string) {
        this._eventStreamIdentifier = eventStreamIdentifier
        this._view = view
        this._inbox = inbox
        this._shape = shape
    }


    get eventStreamIdentifier(): string {
        return this._eventStreamIdentifier;
    }

    get view(): INode {
        return this._view;
    }

    get inbox(): string {
        return this._inbox;
    }

    get shape(): string | undefined {
        return this._shape;
    }

    fragmentSize(): number {
        return this.view.viewDescription.managedBy.bucketizeStrategy.pageSize ?? Infinity;
    }

    getStore(): Store {
        const store = this.view.getStore()
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(RDF.type), namedNode(LDES.EventStream))
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(TREE.node), namedNode(this.view.id))
        if (this.shape) {
            store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(TREE.shape), namedNode(this.shape))
        }
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(LDP.inbox), namedNode(this.inbox))
        return store;
    }

    rootNodeIdentifier(): string {
        return this.view.id
    }
}

class versionedLDESinLDPMetadata extends LDESinLDPMetadata implements IVersionedLDESinLDPMetadata {
    deletedType: string;
    timestampPath: string;
    versionOfPath: string;

    constructor(eventStreamIdentifier: string, view: INode, inbox: string, shape: string, deletedType?: string, timestampPath?: string, versionOfPath?: string) {
        super(eventStreamIdentifier, view, inbox, shape);
        this.deletedType = deletedType ?? LDES.DeletedLDPResource;
        this.timestampPath = timestampPath ?? LDES.timestampPath;
        this.versionOfPath = versionOfPath ?? LDES.versionOfPath;
    }

    getStore(): Store {
        const store = super.getStore();
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(LDES.versionOfPath), namedNode(this.versionOfPath))
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(LDES.timestampPath), namedNode(this.timestampPath))
        return store
    }
}

class Node implements INode {
    private _id: string
    private _relations: IRelation[]
    private _viewDescription: IViewDescription


    constructor(id: string, relations: IRelation[], viewDescription: IViewDescription) {
        this._id = id;
        this._relations = relations;
        this._viewDescription = viewDescription;
    }


    get id(): string {
        return this._id;
    }

    get relations(): IRelation[] {
        return this._relations;
    }

    get viewDescription(): IViewDescription {
        return this._viewDescription;
    }

    getStore(): Store {
        const store = new Store()

        for (const relation of this.relations) {
            const relationStore = relation.getStore()

            const relationId = relationStore.getSubjects(RDF.type, null, null)[0]
            if (!relationId) {
                throw Error("Incorrect relation N3 store.")
            }
            store.addQuad(namedNode(this.id), namedNode(TREE.relation), relationId)
            store.addQuads(relationStore.getQuads(null, null, null, null))
        }

        store.addQuad(namedNode(this.id), namedNode(TREE.viewDescription), namedNode(this.viewDescription.id))
        store.addQuads(this.viewDescription.getStore().getQuads(null, null, null, null))
        return store;
    }
}

class ViewDescription implements IViewDescription {
    private _id: string
    private _managedBy: ILDESinLDPClient
    private _servesDataset: string
    private _endpointURL: string

    constructor(id: string, managedBy: ILDESinLDPClient, eventStreamIdentifier: string, rootNodeIdentifier: string) {
        this._id = id;
        this._managedBy = managedBy;
        this._servesDataset = eventStreamIdentifier;
        this._endpointURL = rootNodeIdentifier;
    }

    get id(): string {
        return this._id;
    }

    get managedBy(): ILDESinLDPClient {
        return this._managedBy;
    }

    get servesDataset(): string {
        return this._servesDataset;
    }

    get endpointURL(): string {
        return this._endpointURL;
    }

    getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.id), namedNode(RDF.type), namedNode(TREE.ViewDescription))
        store.addQuad(namedNode(this.id), namedNode(DCAT.servesDataset), namedNode(this.servesDataset))
        store.addQuad(namedNode(this.id), namedNode(DCAT.endpointURL), namedNode(this.endpointURL))

        store.addQuad(namedNode(this.id), namedNode(LDES.managedBy), namedNode(this.managedBy.id))
        return store
    }


}

class LDESinLDPClient implements ILDESinLDPClient {
    private _bucketizeStrategy: IBucketizeStrategy;
    private _id: string;

    constructor(id: string, bucketizeStrategy: IBucketizeStrategy) {
        this._bucketizeStrategy = bucketizeStrategy;
        this._id = id;
    }

    get bucketizeStrategy(): IBucketizeStrategy {
        return this._bucketizeStrategy;
    }

    get id(): string {
        return this._id;
    }

    getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.id), namedNode(RDF.type), namedNode(LDES.LDESinLDPClient))
        store.addQuad(namedNode(this.id), namedNode(LDES.bucketizeStrategy), namedNode(this.bucketizeStrategy.id))

        store.addQuads(this.bucketizeStrategy.getStore().getQuads(null, null, null, null))
        return store;
    }
}

class BucketizeStrategy implements IBucketizeStrategy {
    private _bucketType: string;
    private _id: string;
    private _pageSize: number | undefined;
    private _path: string;

    constructor(id: string, bucketType: string, path: string, pageSize?: number) {
        this._bucketType = bucketType;
        this._id = id;
        this._pageSize = pageSize;
        this._path = path;
    }

    get bucketType(): string {
        return this._bucketType;
    }

    get id(): string {
        return this._id;
    }

    get pageSize(): number | undefined {
        return this._pageSize;
    }

    get path(): string {
        return this._path;
    }

    getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.id), namedNode(RDF.type), namedNode(LDES.BucketizeStrategy))
        store.addQuad(namedNode(this.id), namedNode(LDES.bucketType), namedNode(this.bucketType))
        store.addQuad(namedNode(this.id), namedNode(TREE.path), namedNode(this.path))
        if (this.pageSize) {
            store.addQuad(namedNode(this.id), namedNode(LDES.pageSize), literal(this.pageSize))
        }
        return store;
    }
}

class GreaterThanOrEqualToRelation implements IRelation {
    private _node: string;
    private _path: string;
    private _value: string; // value here is expected to be able to be parsed as a dateTime object (ISO8601 format)

    constructor(node: string, path: string, value: string) {
        this._node = node;
        this._path = path;
        this._value = value;

        if (isNaN(new Date(value).valueOf())) {
            throw Error("Value can not be parsed as date time.")
        }
    }

    get node(): string {
        return this._node;
    }

    get path(): string {
        return this._path;
    }

    get value(): string {
        return this._value;
    }

    get type(): string {
        return TREE.GreaterThanOrEqualToRelation
    }

    getStore(): Store {
        const store = new Store()
        const bn = store.createBlankNode()
        store.addQuad(bn, namedNode(RDF.type), namedNode(this.type))
        store.addQuad(bn, namedNode(TREE.path), namedNode(this.path))
        store.addQuad(bn, namedNode(TREE.value), dateToLiteral(new Date(this.value)))
        store.addQuad(bn, namedNode(TREE.node), namedNode(this.node))
        return store;
    }
}

export class LILMetadataInitializer {
    static createLDESinLDPMetadata(lilURL: string, args?: {
        lilConfig?: { treePath: string, shape?: string, pageSize?: number },
        date?: Date
    }): ILDESinLDPMetadata {
        args = args ?? {}

        const date = args.date ?? new Date()

        const pageSize = args.lilConfig ? args.lilConfig.pageSize : undefined;
        const treePath = args.lilConfig ? args.lilConfig.treePath : undefined;
        const shape = args.lilConfig ? args.lilConfig.shape : undefined;

        const eventStreamIdentifier = `${lilURL}#EventStream`

        const relation = this.createRelation(lilURL, treePath, date)
        const viewDescription = this.createViewDescription(eventStreamIdentifier, lilURL, pageSize, treePath)

        const node = new Node(lilURL, [relation], viewDescription)
        return new LDESinLDPMetadata(eventStreamIdentifier, node, relation.node, shape)
    }

    public static createRelation(rootNodeURL: string, path?: string, date?: Date): IRelation {
        date = date ?? new Date()
        path = path ?? DCT.created

        const relationURL = getRelationIdentifier(rootNodeURL, date)
        return new GreaterThanOrEqualToRelation(relationURL, path, date.toISOString())
    }

    protected static createViewDescription(eventStreamIdentifier: string, rootNodeIdentifier: string, pageSize?: number, path?: string): ViewDescription {
        path = path ?? DCT.created

        const bucketizeStrategy = new BucketizeStrategy(`${rootNodeIdentifier}#BucketizeStrategy`, LDES.timestampFragmentation, path, pageSize)
        const lilClient = new LDESinLDPClient(`${rootNodeIdentifier}#LDESinLDPClient`, bucketizeStrategy)
        return new ViewDescription(`${rootNodeIdentifier}#ViewDescription`, lilClient, eventStreamIdentifier, rootNodeIdentifier)
    }
}

export class LILMetadataParser {
    // TODO use this to parse whichever I need
}

/*function createLDESinLDPMetadata(store: Store): ILDESinLDPMetadata {
    // TODO
}*/

export interface LDESMetadata {
    ldesEventStreamIdentifier: string
    timestampPath: string
    versionOfPath: string
    deletedType: string
    fragmentSize?: number // Note: temporary -> after discussion with Arthur should be changed
    views: {
        id: string
        relations: Relation[]
    }[]
    inbox: string
}

export function extractLdesMetadata(store: Store, ldesIdentifier: string): LDESMetadata {
    let snapshotOptions: ISnapshotOptions
    const views = []
    let inbox: string
    const str = storeToString(store)
    let fragmentSize: number | undefined
    try {
        snapshotOptions = extractSnapshotOptions(store, ldesIdentifier)
        const viewIdentifiers = store.getObjects(ldesIdentifier, TREE.view, null).map(object => object.value)
        for (const viewIdentifier of viewIdentifiers) {
            const relationIdentifiers = store.getObjects(viewIdentifier, TREE.relation, null)
            const relations = []
            for (const relationIdentifier of relationIdentifiers) {
                let relation: Relation = {
                    node: store.getObjects(relationIdentifier, TREE.node, null).map(object => object.value)[0],
                    type: store.getObjects(relationIdentifier, RDF.type, null).map(object => object.value)[0],
                    value: store.getObjects(relationIdentifier, TREE.value, null).map(object => object.value)[0],
                    path: store.getObjects(relationIdentifier, TREE.path, null).map(object => object.value)[0]
                }
                relations.push(relation)
            }
            views.push({id: viewIdentifier, relations: relations})

            if (store.getObjects(viewIdentifier, LDES.pageSize, null)[0]) { // NOTE: might be changed based on viewDescription
                fragmentSize = parseInt(store.getObjects(viewIdentifier, LDES.pageSize, null)[0].value)
            }

        }

        inbox = store.getObjects(null, LDP.inbox, null)[0].value
    } catch (e) {
        throw Error(`Could not extract LDES metadata for ${ldesIdentifier}.`)
    }
    return {
        deletedType: LDES.DeletedLDPResource,
        ldesEventStreamIdentifier: extractLDESIdentifier(store),
        views: views,
        timestampPath: snapshotOptions.timestampPath!,
        versionOfPath: snapshotOptions.versionOfPath!,
        inbox: inbox,
        fragmentSize
    }
}

export function extractLDESIdentifier(store: Store) {
    const ldes = store.getSubjects(RDF.type, LDES.EventStream, null)
    if (ldes.length > 1) {
        console.log(`Multiple LDESes detected. ${ldes[0].value} was extracted`)
    }
    return ldes[0].value
}
