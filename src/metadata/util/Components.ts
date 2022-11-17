/***************************************
 * Title: Components
 * Description: Contains classes that model tree:Node, tree:ViewDescription, tree:GreaterThanOrEqualToRelation and tree:BucketizeStrategy
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {DataFactory, Store} from "n3";
import {DCAT, LDES, RDF, TREE, XSD} from "../../util/Vocabularies";
import {dateToLiteral} from "../../util/TimestampUtil";
import {namedNode} from "@rdfjs/data-model";
import {
    IBucketizeStrategy,
    IDurationAgoPolicy,
    ILatestVersionSubset,
    ILDESinLDPClient,
    INode,
    IRelation,
    IRetentionPolicy,
    IViewDescription
} from "./Interfaces";
import {parse} from 'tinyduration';
import {NamedNode} from "rdf-js";
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

            // make sure new identifier is made for each relation
            let bn = store.createBlankNode()
            store.addQuad(namedNode(this.id), namedNode(TREE.relation), bn)

            relationStore.getQuads(null, null, null, null).forEach((quad) => {
                store.addQuad(bn, quad.predicate, quad.object)
            })
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
    private _retentionPolicies: IRetentionPolicy[]

    constructor(id: string, managedBy: ILDESinLDPClient, eventStreamIdentifier: string, rootNodeIdentifier: string, retentionPolicies?: IRetentionPolicy[]) {
        this._id = id;
        this._managedBy = managedBy;
        this._servesDataset = eventStreamIdentifier;
        this._endpointURL = rootNodeIdentifier;
        this._retentionPolicies = retentionPolicies ?? []
    }

    get id(): string {
        return this._id;
    }

    get managedBy(): ILDESinLDPClient {
        return this._managedBy;
    }

    get retentionPolicies(): IRetentionPolicy[] {
        return this._retentionPolicies;
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

        this.retentionPolicies.forEach(policy => {
            store.addQuads(policy.getStore().getQuads(null, null, null, null))
        })
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

/**
 * Class for the `tree:GreaterThanOrEqualToRelation` (TREE hypermedia specification §6.1.3)
 *
 * Each member that can be found by following the node has a value that is GTE than the value of the relation.
 * The value of a member is calculated by following the `tree:path` on each member.
 */
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

export class DurationAgoPolicy implements IDurationAgoPolicy {
    // https://www.twilio.com/blog/parse-iso8601-duration-javascript
    private _type: NamedNode;
    private _value: string;
    private _id: string;

    constructor(id: string, value: string) {
        this._value = value;
        this._id = id
        this._type = LDES.terms.DurationAgoPolicy
        parse(value)
    }

    get id(): string {
        return this._id;
    }

    get type(): string {
        return this._type.value;
    }

    get value(): string {
        return this._value;
    }

    getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.id), RDF.terms.type, this._type)
        store.addQuad(namedNode(this.id), TREE.terms.value, literal(this.value, XSD.terms.duration))
        return store;
    }
}

export class LatestVersionSubset implements ILatestVersionSubset {
    private _amount: number;
    private _id: string;
    private _timestampPath?: string;
    private _type: NamedNode;
    private _versionOfPath?: string;

    constructor(amount: number, id: string, opt?: { timestampPath?: string, versionOfPath?: string }) {
        this._amount = amount;
        this._id = id;
        this._timestampPath = opt?.timestampPath
        this._versionOfPath = opt?.versionOfPath
        this._type = LDES.terms.LatestVersionSubset
    }

    get amount(): number {
        return this._amount;
    }

    get id(): string {
        return this._id;
    }

    get timestampPath(): string | undefined {
        return this._timestampPath;
    }

    get type(): string {
        return this._type.value;
    }

    get versionOfPath(): string | undefined {
        return this._versionOfPath;
    }

    getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.id), RDF.terms.type, this._type)
        store.addQuad(namedNode(this.id), LDES.terms.amount, literal(this.amount))
        if (this.timestampPath) {
            store.addQuad(namedNode(this.id), LDES.terms.timestampPath, namedNode(this.timestampPath))
        }
        if (this.versionOfPath) {
            store.addQuad(namedNode(this.id), LDES.terms.versionOfPath, namedNode(this.versionOfPath))
        }
        return store;
    }
}
