import {Member} from "@treecg/types";
import {DataFactory} from "n3";
import {DCT, XSD} from "@treecg/ldes-snapshot";
import {extractDateFromMember} from "../../../src/util/MemberUtil";

const {namedNode, quad, literal} = DataFactory
describe('A MemberUtil', () => {
    const memberIRI = 'http://example.org/memberA';
    let member: Member;

    describe('for extracting a date from a `tree:member`', () => {
        const date = new Date();
        const propertyPath = DCT.created;

        beforeEach(() => {
            const memberNode = namedNode(memberIRI)

            member = {
                id: memberNode,
                quads: [quad(memberNode, namedNode(propertyPath), literal(date.toISOString(), XSD.terms.dateTime))]

            }
        });
        it('extracts the data when such a property exists in the given member', async () => {
            expect(extractDateFromMember(member, propertyPath).getTime()).toEqual(date.getTime())
        });

    })
});
