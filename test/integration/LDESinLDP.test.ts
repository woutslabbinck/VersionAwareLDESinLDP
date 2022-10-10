import {baseUrl} from "../util/solidHelper";
import {DCT, LDP} from "../../src/util/Vocabularies";
import {LDESConfig} from "../../src/ldes/LDESConfig";
import {retrieveWriteLocation} from "../../src/ldes/Util";
import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";

describe('An LDESinLDP', () => {
    const lilIdentifier = baseUrl + 'ldesinldp_lil/'

    const communication = new LDPCommunication()
    const ldesinldp = new LDESinLDP(lilIdentifier, communication)


    describe('when initialising an LDES in LDP', () => {
        const lilIdentifier = baseUrl + 'ldesinldp_init/'
        const treePath = DCT.created
        const versionOfPath = DCT.isVersionOf

        const config: LDESConfig ={
            LDESinLDPIdentifier: lilIdentifier,
            treePath,
            versionOfPath
        }

        it('fails when the given LDESinLDPIdentifier is not a container.', async () => {
            await expect(ldesinldp.initialise({
                LDESinLDPIdentifier: 'http://example.org',
                treePath,
                versionOfPath
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

        it('does nothing when it was already initialised', async () => {
            config.LDESinLDPIdentifier = baseUrl + 'lil_init_v2/'
            await ldesinldp.initialise(config)

            await expect(ldesinldp.initialise(config)).resolves.toBeUndefined()

        })
    })

})
