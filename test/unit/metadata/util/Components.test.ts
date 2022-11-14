import "jest-rdf"
import {DataFactory, Store} from "n3";
import namedNode = DataFactory.namedNode;
import {LDES, RDF, TREE} from "../../../../src/util/Vocabularies";
import literal = DataFactory.literal;
import {BucketizeStrategy, GreaterThanOrEqualToRelation, Node} from "../../../../src/metadata/util/Components";
import {dateToLiteral} from "../../../../src/util/TimestampUtil";
import {IRelation} from "../../../../src/metadata/util/Interfaces";

describe('The following component for LIL metadata:', () => {
    const lilURL = "http://localhost:3000/lil/"
    const eventStreamIdentifier = lilURL + "#EventStream"
    const bucketizeIdentifier = lilURL + "#BucketizeStrategy"
    const treePath = "http://example.org/time"

    const date = new Date()

    let store: Store
    describe('BucketizeStrategy', () => {
        let bucketizeStrategy: BucketizeStrategy
        const pageSize = 10
        const fragmentType = "lol"

        beforeEach(() => {
            store = new Store()
            store.addQuad(namedNode(bucketizeIdentifier), namedNode(RDF.type), namedNode(LDES.BucketizeStrategy))
            store.addQuad(namedNode(bucketizeIdentifier), namedNode(LDES.bucketType), namedNode(fragmentType))
            store.addQuad(namedNode(bucketizeIdentifier), namedNode(TREE.path), namedNode(treePath))
        });

        it('initializes the expected strategy.', () => {
            bucketizeStrategy = new BucketizeStrategy(bucketizeIdentifier, fragmentType, treePath)
            expect(bucketizeStrategy.getStore()).toBeRdfIsomorphic(store)
        });

        it('initializes the expected strategy with pageSize.', () => {
            store.addQuad(namedNode(bucketizeIdentifier), namedNode(LDES.pageSize), literal(pageSize))
            bucketizeStrategy = new BucketizeStrategy(bucketizeIdentifier, fragmentType, treePath, pageSize)
            expect(bucketizeStrategy.getStore()).toBeRdfIsomorphic(store)
        });
    });

    describe('GreaterThanOrEqualToRelation', () => {
        let gteRelation: GreaterThanOrEqualToRelation
        const nodeURL = lilURL + 'node/'

        beforeEach(() => {
            store = new Store()
            const bn = store.createBlankNode()
            store.addQuad(bn, namedNode(RDF.type), namedNode(TREE.GreaterThanOrEqualToRelation))
            store.addQuad(bn, namedNode(TREE.path), namedNode(treePath))
            store.addQuad(bn, namedNode(TREE.value), dateToLiteral(date))
            store.addQuad(bn, namedNode(TREE.node), namedNode(nodeURL))
        });

        it('initializes the relation.', () => {
            gteRelation = new GreaterThanOrEqualToRelation(nodeURL, treePath, date.toISOString())
            expect(gteRelation.getStore()).toBeRdfIsomorphic(store)
        });

        it('fails to initialize when passed an incorrect value', () => {
            expect(() => new GreaterThanOrEqualToRelation(nodeURL, treePath, "" + date.getTime())).toThrow(Error)
        });
    });

    describe('Node', () => {
        let node: Node

        beforeEach(() => {
            store = new Store()
            store.addQuad(namedNode(lilURL), namedNode(RDF.type), namedNode(TREE.Node))
        });

        it('initializes a tree node.', () => {
            node = new Node(lilURL, [])
            expect(node.getStore()).toBeRdfIsomorphic(store)
        });

        it('throws an Error when there is an incorrect relation.', () => {
            const relation: IRelation = {
                getStore(): Store {
                    return new Store();
                }, node: "", path: "", type: "", value: ""
            }

            node = new Node(lilURL, [relation])

            expect(() => node.getStore()).toThrow(Error)
        });
    });
});
