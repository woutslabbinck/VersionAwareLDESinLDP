import "jest-rdf"
import {DCAT, DCT, LDES, TREE, XSD} from "../../../src/util/Vocabularies";
import {DataFactory, Store} from "n3";
import {turtleStringToStore} from "../../../src/util/Conversion";
import {MetadataParser} from "../../../src/metadata/MetadataParser";
import {MetadataInitializer} from "../../../src/metadata/MetadataInitializer";
import {RDF} from "@solid/community-server";
import * as Rdf from "@rdfjs/types";
import {dateToLiteral} from "../../../src/util/TimestampUtil";
import {getRelationIdentifier} from "../../../src/ldes/Util";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import quad = DataFactory.quad;

function generateMetadata(lilURL: string, date?: Date): string {
    date = date ?? new Date()
    return `
<${lilURL}#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<${lilURL}#EventStream> <https://w3id.org/tree#view> <${lilURL}> .
<${lilURL}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<${lilURL}> <https://w3id.org/tree#relation> _:b0 .
<${lilURL}> <https://w3id.org/tree#viewDescription> <${lilURL}#ViewDescription> .
<${lilURL}> <http://www.w3.org/ns/ldp#inbox> <${lilURL}${date.valueOf()}/> .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${lilURL}${date.valueOf()}/> .
<${lilURL}#ViewDescription> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#ViewDescription> .
<${lilURL}#ViewDescription> <http://www.w3.org/ns/dcat#servesDataset> <${lilURL}#EventStream> .
<${lilURL}#ViewDescription> <http://www.w3.org/ns/dcat#endpointURL> <${lilURL}> .
<${lilURL}#ViewDescription> <https://w3id.org/ldes#managedBy> <${lilURL}#LDESinLDPClient> .
<${lilURL}#LDESinLDPClient> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#LDESinLDPClient> .
<${lilURL}#LDESinLDPClient> <https://w3id.org/ldes#bucketizeStrategy> <${lilURL}#BucketizeStrategy> .
<${lilURL}#BucketizeStrategy> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#BucketizeStrategy> .
<${lilURL}#BucketizeStrategy> <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
<${lilURL}#BucketizeStrategy> <https://w3id.org/ldes#bucketType> <https://w3id.org/ldes#timestampFragmentation> .`
}

describe('A MetadataParser', () => {
    let store: Store
    const lilURL = "http://localhost:3000/lil/"
    const eventStreamIdentifier = lilURL + "#EventStream"
    const date = new Date()
    const viewDescriptionIdentifier = lilURL + "#ViewDescription"

    beforeEach(async () => {
        store = await turtleStringToStore(generateMetadata(lilURL, date))
    });

    describe('parsing Relations.', () => {
        let bn: Rdf.BlankNode
        const randomNode = namedNode("random")
        beforeEach(() => {
            store = new Store()
            bn = store.createBlankNode()
            store.addQuad(bn, RDF.terms.type, TREE.terms.GreaterThanOrEqualToRelation)
            store.addQuad(bn, TREE.terms.value, dateToLiteral(date))
            store.addQuad(bn, TREE.terms.node, randomNode)
            store.addQuad(bn, TREE.terms.path, randomNode)

        });

        it('succeeds when everything is present.', () => {
            const relation = MetadataParser.parseRelation(store, bn)
            expect(relation.getStore()).toBeRdfIsomorphic(store)
        });

        it('fails when a relation is present which is no type.', () => {
            store.delete(quad(bn, RDF.terms.type, TREE.terms.GreaterThanOrEqualToRelation))
            expect(() => MetadataParser.parseRelation(store, bn)).toThrow(Error)
        });

        it('fails when a relation is present which is not of type GTE.', () => {
            store.delete(quad(bn, RDF.terms.type, TREE.terms.GreaterThanOrEqualToRelation))
            store.addQuad(bn, RDF.terms.type, namedNode(TREE.namespace + "Relation"))
            expect(() => MetadataParser.parseRelation(store, bn)).toThrow(Error)
        });

        it('fails when a relation is present with no node.', () => {
            store.delete(quad(bn, TREE.terms.node, randomNode))
            expect(() => MetadataParser.parseRelation(store, bn)).toThrow(Error)
        });

        it('fails when a relation is present with no value.', () => {
            store.delete(quad(bn, TREE.terms.value, dateToLiteral(date)))
            expect(() => MetadataParser.parseRelation(store, bn)).toThrow(Error)
        });

        it('fails when a relation is present with no path.', () => {
            store.delete(quad(bn, TREE.terms.path, randomNode))
            expect(() => MetadataParser.parseRelation(store, bn)).toThrow(Error)
        });
    });

    describe('parsing a ViewDescription', () => {
        let viewDescriptionNode: Rdf.NamedNode
        let lilClientNode: Rdf.NamedNode
        let bucketizeStrategyNode: Rdf.NamedNode
        const randomNode = namedNode("random")
        const pageSize = 10

        beforeEach(() => {
            store = new Store()
            viewDescriptionNode = namedNode(viewDescriptionIdentifier)
            lilClientNode = namedNode(lilURL + "#Client")
            bucketizeStrategyNode = namedNode(lilURL + "#BucketizeStrategy")

            store.addQuad(viewDescriptionNode, RDF.terms.type, TREE.terms.ViewDescription)
            store.addQuad(viewDescriptionNode, DCAT.terms.servesDataset, namedNode(eventStreamIdentifier))
            store.addQuad(viewDescriptionNode, DCAT.terms.endpointURL, namedNode(lilURL))
            store.addQuad(viewDescriptionNode, LDES.terms.managedBy, lilClientNode)

            store.addQuad(lilClientNode, RDF.terms.type, LDES.terms.LDESinLDPClient)
            store.addQuad(lilClientNode, LDES.terms.bucketizeStrategy, bucketizeStrategyNode)

            store.addQuad(bucketizeStrategyNode, RDF.terms.type, LDES.terms.BucketizeStrategy)
            store.addQuad(bucketizeStrategyNode, LDES.terms.bucketType, randomNode)
            store.addQuad(bucketizeStrategyNode, TREE.terms.path, randomNode)
            store.addQuad(bucketizeStrategyNode, LDES.terms.pageSize, literal(pageSize))
        });

        it('succeeds when everything is present.', () => {
            const viewDescription = MetadataParser.parseViewDescription(store, viewDescriptionNode)
            expect(viewDescription.getStore()).toBeRdfIsomorphic(store)
        });

        it('fails when a view description is present without servesDataset.', () => {
            store.delete(quad(viewDescriptionNode, DCAT.terms.servesDataset, namedNode(eventStreamIdentifier)))

            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        it('fails when a view description is present without endpointURL.', () => {
            store.delete(quad(viewDescriptionNode, DCAT.terms.endpointURL, namedNode(lilURL)))
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        it('fails when a view description is present without entity managing the LDES.', () => {
            store.delete(quad(viewDescriptionNode, LDES.terms.managedBy, lilClientNode))
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        /*        it('fails when the entity managing the LIL is not an LDESinLDPClient.', () => {
                    expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)

                });*/

        it('fails when no bucketizeStrategy is present in the entity managing the LIL', () => {
            store.delete(quad(lilClientNode, LDES.terms.bucketizeStrategy, bucketizeStrategyNode))
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        it('fails when a bucketizeStrategy does not have a path.', () => {
            store.delete(quad(bucketizeStrategyNode, TREE.terms.path, randomNode))
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        it('fails when a bucketizeStrategy does not have a bucket type.', () => {
            store.delete(quad(bucketizeStrategyNode, LDES.terms.bucketType, randomNode))
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });

        /*        it('fails when a bucketizeStrategy its bucketType is not a timestampFragmentation.', () => {
                    expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)

                });*/

        it('fails when pageSize cannot be parsed as a number.', () => {
            store.delete(quad(bucketizeStrategyNode, LDES.terms.pageSize, literal(pageSize)))
            store.addQuad(bucketizeStrategyNode, LDES.terms.pageSize, randomNode)
            expect(() => MetadataParser.parseViewDescription(store, viewDescriptionNode)).toThrow(Error)
        });
    });

    describe('parsing retention policies', () => {
        let store: Store
        let durationAgoPolicyNode = namedNode(lilURL + "#duration")
        let latestVersionSubsetNode = namedNode(lilURL + "#lvs")

        function generateDurationAgoPolicy(store: Store) {
            store.addQuad(durationAgoPolicyNode, RDF.terms.type, LDES.terms.DurationAgoPolicy)
            store.addQuad(durationAgoPolicyNode, TREE.terms.value, literal("P1Y", XSD.terms.duration))
        }

        function generateLatestVersionSubsetNode(store: Store) {
            store.addQuad(latestVersionSubsetNode, RDF.terms.type, LDES.terms.LatestVersionSubset)
            store.addQuad(latestVersionSubsetNode, LDES.terms.amount, literal("5", XSD.terms.integer))
        }

        beforeEach(() => {
            store = new Store()
        });

        it('does not parse anything if it does not recognize the type.', () => {
            store.addQuad(durationAgoPolicyNode, RDF.terms.type, namedNode("a"))
            const policies = MetadataParser.parseRetentionPolicies(store, [durationAgoPolicyNode])
            expect(policies.length).toBe(0)
        })

        it('does not parse anything when a policy has multiple types.', () => {
            store.addQuad(durationAgoPolicyNode, RDF.terms.type, namedNode(LDES.namespace + "RetentionPolicy"))
            generateDurationAgoPolicy(store)
            const policies = MetadataParser.parseRetentionPolicies(store, [durationAgoPolicyNode])
            expect(policies.length).toBe(0)
        })

        it('parses a single Duration Ago Policy correctly.', () => {
            generateDurationAgoPolicy(store)
            const policies = MetadataParser.parseRetentionPolicies(store, [durationAgoPolicyNode])
            expect(policies.length).toBe(1)
            expect(policies[0].getStore()).toBeRdfIsomorphic(store)
        });

        it('parses a single Latest Version Subset policy correctly.', () => {
            generateLatestVersionSubsetNode(store)
            const policies = MetadataParser.parseRetentionPolicies(store, [latestVersionSubsetNode])
            expect(policies.length).toBe(1)
            expect(policies[0].getStore()).toBeRdfIsomorphic(store)
        });

        it('parses a single Latest Version Subset policy correctly (with timestamp and version).', () => {
            generateLatestVersionSubsetNode(store)
            store.addQuad(latestVersionSubsetNode, LDES.terms.timestampPath, DCT.terms.created)
            store.addQuad(latestVersionSubsetNode, LDES.terms.versionOfPath, DCT.terms.isVersionOf)
            const policies = MetadataParser.parseRetentionPolicies(store, [latestVersionSubsetNode])
            expect(policies.length).toBe(1)
            expect(policies[0].getStore()).toBeRdfIsomorphic(store)
        });

        it('parses multiple policies when present.', () => {
            generateLatestVersionSubsetNode(store)
            generateDurationAgoPolicy(store)
            const policies = MetadataParser.parseRetentionPolicies(store, [latestVersionSubsetNode, durationAgoPolicyNode])
            expect(policies.length).toBe(2)
        });

        it('throws an error when a Duration Ago Policy has multiple values.', () => {
            generateDurationAgoPolicy(store)
            store.addQuad(durationAgoPolicyNode, TREE.terms.value, literal("P2Y", XSD.terms.duration))
            expect(() => MetadataParser.parseRetentionPolicies(store, [durationAgoPolicyNode])).toThrow(Error)
        });

        it('throws an error when a Duration Ago Policy a non duration value.', () => {
            // duration value itself
            store.addQuad(durationAgoPolicyNode, RDF.terms.type, LDES.terms.DurationAgoPolicy)
            store.addQuad(durationAgoPolicyNode, TREE.terms.value, literal("asdf", XSD.terms.duration))
            expect(() => MetadataParser.parseRetentionPolicies(store, [durationAgoPolicyNode])).toThrow(Error)

            // datatype of duration
            const typeStore = new Store()
            typeStore.addQuad(durationAgoPolicyNode, RDF.terms.type, LDES.terms.DurationAgoPolicy)
            typeStore.addQuad(durationAgoPolicyNode, TREE.terms.value, literal("P2Y"))
            expect(() => MetadataParser.parseRetentionPolicies(typeStore, [durationAgoPolicyNode])).toThrow(Error)
        });

        it('throws an error when a Latest Version Subset policy  has multiple values.', () => {
            generateLatestVersionSubsetNode(store)
            store.addQuad(latestVersionSubsetNode, LDES.terms.amount, literal("7"))
            expect(() => MetadataParser.parseRetentionPolicies(store, [latestVersionSubsetNode])).toThrow(Error)
        });

        it('throws an error when a Latest Version Subset policy a wrong value for amount.', () => {
            store.addQuad(latestVersionSubsetNode, RDF.terms.type, LDES.terms.LatestVersionSubset)
            store.addQuad(latestVersionSubsetNode, LDES.terms.amount, literal("asdf"))
            expect(() => MetadataParser.parseRetentionPolicies(store, [latestVersionSubsetNode])).toThrow(Error)
        });


    });

    describe('parsing an LDES in LDP', () => {
        it('parses to metadata correctly.', async () => {
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store)
            const metadata = MetadataInitializer.generateLDESinLDPMetadata(lilURL, {date})
            expect(parsedMetadata).toEqual(metadata)
        });

        it('parses one without view description.', async () => {
            store = await turtleStringToStore(`
            <${lilURL}#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<${lilURL}#EventStream> <https://w3id.org/tree#view> <${lilURL}> .
<${lilURL}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<${lilURL}> <https://w3id.org/tree#relation> _:b0 .
<${lilURL}> <http://www.w3.org/ns/ldp#inbox> <${lilURL}${date.valueOf()}/> .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${lilURL}${date.valueOf()}/> .
            `)
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store)
            expect(parsedMetadata.view.viewDescription).toBeUndefined()
            expect(parsedMetadata.fragmentSize).toBe(Infinity)
        });

        it('parses pageSize correctly.', () => {
            store.addQuad(namedNode(`${lilURL}#BucketizeStrategy`), namedNode(LDES.pageSize), literal(10))
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store)
            const metadata = MetadataInitializer.generateLDESinLDPMetadata(lilURL, {
                date, lilConfig: {
                    pageSize: 10,
                    treePath: DCT.created
                }
            })
            expect(parsedMetadata).toEqual(metadata)
            expect(parsedMetadata.fragmentSize).toBe(10)
        })

        it('fails when no inbox is present', async () => {
            store = await turtleStringToStore(`
            <${lilURL}#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<${lilURL}#EventStream> <https://w3id.org/tree#view> <${lilURL}> .
<${lilURL}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<${lilURL}> <https://w3id.org/tree#relation> _:b0 .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:b0 <https://w3id.org/tree#value> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${lilURL}${date.valueOf()}/> .
            `)
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        })

        it('fails when no LDES is present.', async () => {
            store = new Store()
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('fails when multiple LDES are present.', async () => {
            store.addQuad(namedNode('a'), namedNode(RDF.type), namedNode(LDES.EventStream))
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('parses an LDES in LDP correctly when multiple LDES are present, given its LDES identifier.', async () => {
            store.addQuad(namedNode('a'), namedNode(RDF.type), namedNode(LDES.EventStream))
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store, eventStreamIdentifier)
            const metadata = MetadataInitializer.generateLDESinLDPMetadata(lilURL, {date})
            expect(parsedMetadata).toEqual(metadata)
        });

        it('fails when there is no view.', async () => {
            store = new Store()
            store.addQuad(namedNode('a'), namedNode(RDF.type), namedNode(LDES.EventStream))
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('fails when there are multiple views.', async () => {
            store = new Store()
            store.addQuad(namedNode('a'), namedNode(RDF.type), namedNode(LDES.EventStream))
            store.addQuad(namedNode('a'), namedNode(TREE.view), namedNode('b'))
            store.addQuad(namedNode('a'), namedNode(TREE.view), namedNode('c'))
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('fails when servesDataset in the view description is not pointing to the LDES.', () => {
            store.delete(quad(namedNode(viewDescriptionIdentifier), namedNode(DCAT.servesDataset), namedNode(eventStreamIdentifier)))
            store.addQuad(namedNode(viewDescriptionIdentifier), namedNode(DCAT.servesDataset), namedNode("random"))
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('fails when endpointURL in the view description is not pointing to the LIL view.', () => {
            store.delete(quad(namedNode(viewDescriptionIdentifier), namedNode(DCAT.endpointURL), namedNode(lilURL)))
            store.addQuad(namedNode(viewDescriptionIdentifier), namedNode(DCAT.endpointURL), namedNode("random"))
            expect(() => MetadataParser.extractLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('correctly parses metadata with two relations.', () => {
            const node1 = getRelationIdentifier(lilURL, date)
            const date2 = new Date("2022-01-01")
            const node2 = getRelationIdentifier(lilURL, date2)
            const bn = store.createBlankNode()
            store.addQuad(namedNode(lilURL), TREE.terms.relation, bn)
            store.addQuad(bn, RDF.terms.type, TREE.terms.GreaterThanOrEqualToRelation)
            store.addQuad(bn, TREE.terms.path, DCT.terms.created)
            store.addQuad(bn, TREE.terms.value, dateToLiteral(date2))
            store.addQuad(bn, TREE.terms.node, namedNode(node2))
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store)
            expect(parsedMetadata.getStore()).toBeRdfIsomorphic(store)

        });
    });

    describe('parsing a Versioned LDES in LDP', () => {
        it('fails when no timestamppath and versionofpath is present.', async () => {
            expect(() => MetadataParser.extractVersionedLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('fails when no timestamppath is present.', async () => {
            store.addQuad(namedNode(eventStreamIdentifier), namedNode(LDES.versionOfPath), namedNode(DCT.created))
            expect(() => MetadataParser.extractVersionedLDESinLDPMetadata(store)).toThrow(Error)

        });
        it('fails when no timestamppath or versionofpath is present.', async () => {
            store.addQuad(namedNode(eventStreamIdentifier), namedNode(LDES.timestampPath), namedNode(DCT.created))
            expect(() => MetadataParser.extractVersionedLDESinLDPMetadata(store)).toThrow(Error)
        });

        it('parses to metadata correctly.', () => {
            store.addQuad(namedNode(eventStreamIdentifier), namedNode(LDES.versionOfPath), namedNode(DCT.isVersionOf))
            store.addQuad(namedNode(eventStreamIdentifier), namedNode(LDES.timestampPath), namedNode(DCT.created))
            const parsedMetadata = MetadataParser.extractVersionedLDESinLDPMetadata(store)
            const metadata = MetadataInitializer.generateVersionedLDESinLDPMetadata(lilURL, {date})
            expect(parsedMetadata).toEqual(metadata)
        });
    })
});
