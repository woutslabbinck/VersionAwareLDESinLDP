import {baseUrl} from "../util/solidHelper";
import {DCT, LDP} from "../../src/util/Vocabularies";
import {retrieveWriteLocation} from "../../src/ldes/Util";
import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";
import {LILConfig} from "../../src/metadata/LILConfig";

describe('An LDESinLDP', () => {
    const communication = new LDPCommunication()


    describe('when initialising an LDES in LDP', () => {
        const lilIdentifier = baseUrl + 'ldesinldp_init/'
        const ldesinldp = new LDESinLDP(lilIdentifier, communication)

        const treePath = DCT.created

        const config: LILConfig = {
            treePath
        }

        it('fails when the given LDESinLDPIdentifier is not a container.', () => {
            const lilIdentifier = baseUrl + 'lol'
            expect(() => new LDESinLDP(lilIdentifier, communication)).toThrow(Error)
        })

        it('succeeds, given a proper configuration.', async () => {
            await ldesinldp.initialise(config)

            const writeLocation = await retrieveWriteLocation(lilIdentifier, communication)
            const store = await ldesinldp.read(lilIdentifier)

            expect(store.getQuads(lilIdentifier, LDP.contains, writeLocation, null).length).toBe(1)
            expect(store.getQuads(lilIdentifier, LDP.inbox, writeLocation, null).length).toBe(1)
            // maybe create store based on date and do the same isomorphic rdf as in the CSS?
        });

        it('does nothing when it was already initialised', async () => {
            const lilIdentifier = baseUrl + 'ldesinldp_init_v2/'
            const ldesinldp = new LDESinLDP(lilIdentifier, communication)

            await ldesinldp.initialise(config)

            await expect(ldesinldp.initialise(config)).resolves.toBeUndefined()

        })
    })

})
