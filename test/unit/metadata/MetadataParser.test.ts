import {DCT, LDES, TREE} from "../../../src/util/Vocabularies";
import {DataFactory, Store} from "n3";
import {turtleStringToStore} from "../../../src/util/Conversion";
import {MetadataParser} from "../../../src/metadata/MetadataParser";
import {MetadataInitializer} from "../../../src/metadata/MetadataInitializer";
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import {RDF} from "@solid/community-server";

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

    beforeEach(async () => {
        store = await turtleStringToStore(generateMetadata(lilURL, date))
    });
    describe('for an LDES in LDP', () => {

        it('parses to metadata correctly.', async () => {
            const parsedMetadata = MetadataParser.extractLDESinLDPMetadata(store)
            const metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, {date})
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
            const metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, {
                date, lilConfig: {
                    pageSize: 10,
                    treePath: DCT.created
                }
            })
            expect(parsedMetadata).toEqual(metadata)
            expect(parsedMetadata.fragmentSize).toBe(10)
        })

        it('fails when no inbox is present',async () => {
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
    });

    describe('for a Versioned LDES in LDP', () => {
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
            const metadata = MetadataInitializer.createVersionedLDESinLDPMetadata(lilURL, {date})
            expect(parsedMetadata).toEqual(metadata)
        });
    })
});
