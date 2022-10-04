import {LDESMetadata} from "../../../src/util/LdesUtil";
import {Store} from "n3";
import {turtleStringToStore} from "../../../src/util/Conversion";
import {extractLdesMetadata} from "../../../src/util/LdesUtil";
import {filterRelation} from "../../../src/versionawarelil/Util";
import {Relation} from "../../../dist/util/LdesUtil";
import {DCT, TREE} from "../../../dist/util/Vocabularies";

describe('A Version Aware LDES in LDP Util', () => {

    describe('For filtering the relations within an LDES', () => {

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
        let ldesMetadata: LDESMetadata
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
        function createRelation(date: Date): Relation {
            return {
                type: TREE.GreaterThanOrEqualToRelation,
                value: date.toISOString(),
                node: `http://example.org/ldesinldp/${date.valueOf()}/`,
                path: DCT.created
            }
        }

        beforeAll(async () => {
            ldesStore = await turtleStringToStore(lilString)
        });

        beforeEach(() => {
            ldesMetadata = extractLdesMetadata(ldesStore, lilID)
            relations = [createRelation(relationDate)]
        });

        it('errors when there is no view.', () => {
            const {views, ...copy} = ldesMetadata
            const metadata: LDESMetadata = {views: [], ...copy}
            expect(() => filterRelation(metadata, t1, t2)).toThrow(Error)
        });

        it('returns no relations when there are no relations in the metadata.', () => {
            ldesMetadata.views[0].relations.pop()
            expect(filterRelation(ldesMetadata, t1, t2)).toEqual([])

        })

        it('returns all relations R they are within [t1, t2], latest R being the greatest R < t2', () => {
            const biggerThant2 = createRelation(new Date("2022-11-01"))
            ldesMetadata.views[0].relations.push(biggerThant2)
            expect(filterRelation(ldesMetadata, t1, t2)).toEqual(relations)
        });

        it('returns no relations R when all R are > t1 and all R > t2.', () => {
            const biggerThant1 = createRelation(new Date("2022-01-02"))
            ldesMetadata.views[0].relations.push(biggerThant1)

            // this query asks members m which can not be in the window [t1, t2]
            // as we are interested in members in a period before the GTE timestamp of the relations
            expect(filterRelation(ldesMetadata, t0, t1)).toEqual([])
        })

        it('returns the latest relation r where r < t1 and r < t2.', () => {
            const smallerThanT1 = createRelation(new Date("2021-01-01"))
            ldesMetadata.views[0].relations.push(smallerThanT1)

            // There might be members m in r that are within that window
            expect(filterRelation(ldesMetadata, t2, t3)).toEqual(relations)
        });

        it('returns all relations R where R < t2 and only one the smallest relation r: r <t1.', () => {
            const smallest = createRelation(new Date("2021-01-01"))
            const smallerThanT1 = createRelation(new Date("2021-05-01"))
            ldesMetadata.views[0].relations.push(smallest, smallerThanT1)
            relations.push(smallerThanT1)

            for (const relation of relations) {
                expect(filterRelation(ldesMetadata, t1, t2)).toContainEqual(relation)
            }
        });
    });
});
