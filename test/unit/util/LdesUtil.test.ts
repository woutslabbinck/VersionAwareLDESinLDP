import {turtleStringToStore} from "../../../src/util/Conversion";
import {extractLDESIdentifier, extractLdesMetadata} from "../../../src/util/LdesUtil";
import {DataFactory, Store} from "n3";
import {DCT, LDES, TREE} from "../../../src/util/Vocabularies";
import {RDF} from "@solid/community-server";
import namedNode = DataFactory.namedNode;

describe('An LdesUtil', () => {
    describe('for extracting metadata from a versioned LDES in LDP.', () => {
        const lilString = `
<http://example.org/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:genid1 .
<http://example.org/ldesinldp/> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/timestamppath/> .
_:genid1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:genid1 <https://w3id.org/tree#node> <http://example.org/ldesinldp/timestamppath/> .
_:genid1 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:genid1 <https://w3id.org/tree#value> "2022-03-28T14:53:28.841Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://example.org/ldesinldp/#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/tree#view> <http://example.org/ldesinldp/> .
`
        let store: Store
        const ldesIdentifier = 'http://example.org/ldesinldp/#EventStream'
        beforeAll(async () => {
            store = await turtleStringToStore(lilString)

        });

        it('returns an LDESMetadata object when succeeding of the versioned LDES in LDP.', () => {
            const ldesMetadata = extractLdesMetadata(store, ldesIdentifier)
            expect(ldesMetadata.ldesEventStreamIdentifier).toBe(ldesIdentifier)
            expect(ldesMetadata.timestampPath).toBe(DCT.created)
            expect(ldesMetadata.versionOfPath).toBe(DCT.isVersionOf)
            expect(ldesMetadata.deletedType).toBe(LDES.DeletedLDPResource)
            expect(ldesMetadata.views[0].id).toBe('http://example.org/ldesinldp/')
            expect(ldesMetadata.views[0].relations[0].node).toBe('http://example.org/ldesinldp/timestamppath/')
            expect(ldesMetadata.views[0].relations[0].type).toBe(TREE.GreaterThanOrEqualToRelation)
            expect(ldesMetadata.views[0].relations[0].value).toBe("2022-03-28T14:53:28.841Z")
            expect(ldesMetadata.inbox).toBe('http://example.org/ldesinldp/timestamppath/')
            expect(ldesMetadata.timestampPath).toBe(DCT.created)
        });

        it('errors when the store does not contain all the information for the versioned LDES in LDP.', () => {
            expect(() => extractLdesMetadata(new Store(), ldesIdentifier)).toThrow(Error)
        });
    });
    describe('for extracting an LDES identifier', () => {


        it('succeeds when there are one or more LDESes.', () => {
            const store = new Store()
            const ldesIdentifier = 'ex:LDES'
            store.addQuad(namedNode(ldesIdentifier), namedNode(RDF.type), namedNode(LDES.EventStream))
            expect(extractLDESIdentifier(store)).toBe(ldesIdentifier)
        });

        it('fails when there are none.', () => {
            expect(() => extractLDESIdentifier(new Store)).toThrow(Error)

        });
    });
});
