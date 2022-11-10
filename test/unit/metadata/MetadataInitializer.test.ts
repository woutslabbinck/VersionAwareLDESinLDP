import "jest-rdf"
import {storeToString, turtleStringToStore} from "../../../src/util/Conversion";
import {MetadataInitializer} from "../../../src/metadata/MetadataInitializer";
import {DCT, LDES, TREE} from "../../../src/util/Vocabularies";
import {namedNode} from "@rdfjs/data-model";

function generateMetadata(lilURL: string, args?: any): string {
    const date = args.date
    const treePath = args.lilConfig ? args.lilConfig.treePath : DCT.created;
    return `
<${lilURL}#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<${lilURL}#EventStream> <https://w3id.org/tree#view> <${lilURL}> .
<${lilURL}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<${lilURL}> <https://w3id.org/tree#relation> _:b0 .
<${lilURL}> <https://w3id.org/tree#viewDescription> <${lilURL}#ViewDescription> .
<${lilURL}> <http://www.w3.org/ns/ldp#inbox> <${lilURL}${date.valueOf()}/> .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:b0 <https://w3id.org/tree#path> <${treePath}> .
_:b0 <https://w3id.org/tree#value> "${date.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
_:b0 <https://w3id.org/tree#node> <${lilURL}${date.valueOf()}/> .
<${lilURL}#ViewDescription> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#ViewDescription> .
<${lilURL}#ViewDescription> <http://www.w3.org/ns/dcat#servesDataset> <${lilURL}#EventStream> .
<${lilURL}#ViewDescription> <http://www.w3.org/ns/dcat#endpointURL> <${lilURL}> .
<${lilURL}#ViewDescription> <https://w3id.org/ldes#managedBy> <${lilURL}#LDESinLDPClient> .
<${lilURL}#LDESinLDPClient> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#LDESinLDPClient> .
<${lilURL}#LDESinLDPClient> <https://w3id.org/ldes#bucketizeStrategy> <${lilURL}#BucketizeStrategy> .
<${lilURL}#BucketizeStrategy> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#BucketizeStrategy> .
<${lilURL}#BucketizeStrategy> <https://w3id.org/tree#path> <${treePath}> .
<${lilURL}#BucketizeStrategy> <https://w3id.org/ldes#bucketType> <https://w3id.org/ldes#timestampFragmentation> .`
}


describe('A MetadataInitializer', () => {
    const date = new Date()
    let args: any;
    const lilURL = "http://localhost:3000/lil/"
    const eventStreamIdentifier = lilURL + "#EventStream"

    beforeEach(() => {
        args = {date}
    });

    describe('for an LDES in LDP', () => {
        it('generates the correct metadata.', async () => {
            let metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL)
            let generatedDate = new Date(metadata.getStore().getObjects(null, TREE.value, null)[0].value)
            let store = await turtleStringToStore(generateMetadata(lilURL, {date: generatedDate}))
            expect(metadata.getStore().getQuads(null, null, null, null)).toBeRdfIsomorphic(store.getQuads(null, null, null, null))
        });

        it('generates the metadata given a date.', async () => {
            let metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, args)
            let store = await turtleStringToStore(generateMetadata(lilURL, args))
            expect(metadata.getStore().getQuads(null, null, null, null)).toBeRdfIsomorphic(store.getQuads(null, null, null, null))
        });

        it('generates the metadata given a treePath.', async () => {
            const path = 'time'
            args = {lilConfig: {treePath: path}, date}
            let metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, args)
            let store = await turtleStringToStore(generateMetadata(lilURL, args))
            expect(metadata.getStore().getQuads(null, null, null, null)).toBeRdfIsomorphic(store.getQuads(null, null, null, null))
        });

        it('generates the metadata given a shape.', async () => {
            const path = 'time'
            const shapeURL = 'shapeurl'
            args = {lilConfig: {treePath: path, shape: shapeURL}, date}
            let metadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, args)
            let store = await turtleStringToStore(generateMetadata(lilURL, args))
            store.addQuad(namedNode(eventStreamIdentifier), namedNode(TREE.shape), namedNode(shapeURL))
            expect(metadata.getStore().getQuads(null, null, null, null)).toBeRdfIsomorphic(store.getQuads(null, null, null, null))
        });
    })

    describe('for a Versioned LDES in LDP', () => {
        it('generates the correct metadata.', async () => {
            let metadata = MetadataInitializer.createVersionedLDESinLDPMetadata(lilURL)
            expect(metadata.getStore().getQuads(eventStreamIdentifier, LDES.timestampPath,null,null).length).toBe(1)
            expect(metadata.getStore().getQuads(eventStreamIdentifier, LDES.versionOfPath,null,null).length).toBe(1)
        });
    });
});
