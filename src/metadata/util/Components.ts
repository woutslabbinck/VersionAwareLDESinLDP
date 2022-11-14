/***************************************
 * Title: Components
 * Description: Contains classes that model tree:Node, tree:ViewDescription, tree:GreaterThanOrEqualToRelation and tree:BucketizeStrategy
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {DataFactory, Store} from "n3";
import {DCAT, LDES, RDF, TREE} from "../../util/Vocabularies";
import {dateToLiteral} from "../../util/TimestampUtil";
import {namedNode} from "@rdfjs/data-model";
import {IBucketizeStrategy, ILDESinLDPClient, INode, IRelation, IViewDescription} from "./Interfaces";
import literal = DataFactory.literal;

export class Node implements INode {
    private _id: string
    private _relations: IRelation[]
    private _viewDescription?: IViewDescription


    constructor(id: string, relations: IRelation[], viewDescription?: IViewDescription) {
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

    get viewDescription(): IViewDescription | undefined {
        return this._viewDescription;
    }

    getStore(): Store {
        const store = new Store()

        store.addQuad(namedNode(this.id), namedNode(RDF.type), namedNode(TREE.Node))
        for (const relation of this.relations) {
            const relationStore = relation.getStore()

            const relationId = relationStore.getSubjects(RDF.type, null, null)[0]
            if (!relationId) {
                throw Error("Incorrect relation N3 store.")
            }
            store.addQuad(namedNode(this.id), namedNode(TREE.relation), relationId)
            store.addQuads(relationStore.getQuads(null, null, null, null))
        }

        if (this.viewDescription) {
            store.addQuad(namedNode(this.id), namedNode(TREE.viewDescription), namedNode(this.viewDescription.id))
            store.addQuads(this.viewDescription.getStore().getQuads(null, null, null, null))
        }
        return store;
    }
}

export class ViewDescription implements IViewDescription {
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
        store.addQuads(this.managedBy.getStore().getQuads(null, null, null, null))
        return store
    }


}

export class LDESinLDPClient implements ILDESinLDPClient {
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

export class BucketizeStrategy implements IBucketizeStrategy {
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

export class GreaterThanOrEqualToRelation implements IRelation {
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
