import {turtleStringToStore} from "../../../src/util/Conversion";
import {
    extractLDESIdentifier,
    extractLdesMetadata,
    filterRelation,
    LDESMetadata,
    Relation
} from "../../../src/util/LdesUtil";
import {DataFactory, Store} from "n3";
import {DCT, LDES, TREE} from "../../../src/util/Vocabularies";
import {RDF} from "@solid/community-server";
import namedNode = DataFactory.namedNode;
import {ILDESinLDPMetadata} from "../../../src/metadata/LDESinLDPMetadata";
import {MetadataInitializer} from "../../../src/metadata/MetadataInitializer";
import {IRelation} from "../../../src/metadata/util/Interfaces";

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

    describe('For filtering the relations within an LDES', () => {
        let lilURL = 'http://example.org/ldesinldp/'
        const lilID = `http://example.org/ldesinldp/#EventStream`
        const lilString = `
<http://example.org/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#Node> .
<http://example.org/ldesinldp/> <https://w3id.org/tree#relation> _:genid1 .
<http://example.org/ldesinldp/> <http://www.w3.org/ns/ldp#inbox> <http://example.org/ldesinldp/1646092800000/> .
_:genid1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/tree#GreaterThanOrEqualToRelation> .
_:genid1 <https://w3id.org/tree#node> <http://example.org/ldesinldp/1646092800000/> .
_:genid1 <https://w3id.org/tree#path> <http://purl.org/dc/terms/created> .
_:genid1 <https://w3id.org/tree#value> "2022-03-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://example.org/ldesinldp/#EventStream> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#EventStream> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#versionOfPath> <http://purl.org/dc/terms/isVersionOf> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/ldes#timestampPath> <http://purl.org/dc/terms/created> .
<http://example.org/ldesinldp/#EventStream> <https://w3id.org/tree#view> <http://example.org/ldesinldp/> .
`
        let ldesStore: Store;
        let ldesMetadata: ILDESinLDPMetadata
        let relations: Relation[];

        const t0 = new Date(0)
        const t1 = new Date("2022-01-01")
        const t2 = new Date("2022-05-01")
        const t3 = new Date("2022-10-01")

        const relationDate = new Date("2022-03-01")

        /**
         * [t1 ,t2]: startDate-endDate window (t1 = startDate and t2 endDate)
         * R: relationTime
         *
         * No clear boundaries currently done
         */

        /**
         * Utility function to create a GTE Relation based on a date object.
         * @param date
         * @returns {{node: string, path: any, type: any, value: string}}
         */
        function createRelation(date: Date): IRelation {
            const nodeURL = `${lilURL}${date.valueOf()}/`
            const path = DCT.created
            return MetadataInitializer.createRelation(nodeURL, path, date)
            // return {
            //     type: TREE.GreaterThanOrEqualToRelation,
            //     value: date.toISOString(),
            //     node: `http://example.org/ldesinldp/${date.valueOf()}/`,
            //     path: DCT.created
            // }
        }


        beforeEach(() => {
            ldesMetadata = MetadataInitializer.createLDESinLDPMetadata(lilURL, {date: relationDate})
            relations = [createRelation(relationDate)]
        });


        it('returns no relations when there are no relations in the metadata.', () => {
            ldesMetadata.view.relations.pop()
            expect(filterRelation(ldesMetadata, t1, t2)).toEqual([])

        })

        it('returns all relations R they are within [t1, t2], latest R being the greatest R < t2', () => {
            const biggerThant2 = createRelation(new Date("2022-11-01"))
            ldesMetadata.view.relations.push(biggerThant2)
            expect(filterRelation(ldesMetadata, t1, t2)).toEqual(relations)
        });

        it('returns no relations R when all R are > t1 and all R > t2.', () => {
            const biggerThant1 = createRelation(new Date("2022-01-02"))
            ldesMetadata.view.relations.push(biggerThant1)

            // this query asks members m which can not be in the window [t1, t2]
            // as we are interested in members in a period before the GTE timestamp of the relations
            expect(filterRelation(ldesMetadata, t0, t1)).toEqual([])
        })

        it('returns the latest relation r where r < t1 and r < t2.', () => {
            const smallerThanT1 = createRelation(new Date("2021-01-01"))
            ldesMetadata.view.relations.push(smallerThanT1)

            // There might be members m in r that are within that window
            expect(filterRelation(ldesMetadata, t2, t3)).toEqual(relations)
        });

        it('returns all relations R where R < t2 and only one the smallest relation r: r <t1.', () => {
            const smallest = createRelation(new Date("2021-01-01"))
            const smallerThanT1 = createRelation(new Date("2021-05-01"))
            ldesMetadata.view.relations.push(smallest, smallerThanT1)
            relations.push(smallerThanT1)

            for (const relation of relations) {
                expect(filterRelation(ldesMetadata, t1, t2)).toContainEqual(relation)
            }
        });
    });
});
