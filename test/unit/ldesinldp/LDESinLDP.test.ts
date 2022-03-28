import {baseUrl} from "../../util/solidHelper";
import {LDPCommunication} from "../../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../../src/ldesinldp/LDESinLDP";
import {LDESinLDPConfig} from "../../../src/ldesinldp/LDESinLDPConfig";
import {DCT, LDP} from "../../../src/util/Vocabularies";
import {retrieveWriteLocation} from "../../../src/ldesinldp/Util";

describe('An LDESinLDP', () => {
    const lilIdentifier = baseUrl + 'ldesinldp_lil/'

    const communication = new LDPCommunication()
    const ldesinldp = new LDESinLDP(lilIdentifier, communication)

    beforeAll(() => {
        //todo: init ldes in ldp
    })
    describe('when initialising an LDES in LDP', () => {
        const lilIdentifier = baseUrl + 'ldesinldp_init/'
        const treePath = DCT.created

        let config: LDESinLDPConfig
        beforeEach(() => {
            config = {
                LDESinLDPIdentifier: lilIdentifier,
                treePath
            }
        })

        it('fails when the given LDESinLDPIdentifier is not a container.', async () => {
            await expect(ldesinldp.initialise({
                LDESinLDPIdentifier: 'http://example.org',
                treePath
            })).rejects.toThrow(Error)
        })

        it('succeeds, given a proper configuration.', async () => {
            await ldesinldp.initialise(config)

            const writeLocation = await retrieveWriteLocation(lilIdentifier, communication)
            const store = await ldesinldp.read(lilIdentifier)

            expect(store.getQuads(lilIdentifier, LDP.contains, writeLocation, null).length).toBe(1)
            expect(store.getQuads(lilIdentifier, LDP.inbox, writeLocation, null).length).toBe(1)
            // maybe create store based on date and do the same isomorphic rdf as in the CSS?
        });
    })
    describe('when creating a resource from an LDES in LDP', () => {

    })

    describe('when reading a resource from an LDES in LDP', () => {

    })

    describe('when updating a resource from an LDES in LDP', () => {

    })

    describe('when deleting a resource from an LDES in LDP', () => {

    })

    describe('when reading the metadata from an LDES in LDP', () => {

    })

    describe('when reading all the members of an LDES in LDP', () => {

    })
})
