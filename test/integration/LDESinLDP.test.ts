import {baseUrl} from "../util/solidHelper";
import {DCT, LDP} from "../../src/util/Vocabularies";
import {createContainer, retrieveWriteLocation} from "../../src/ldes/Util";
import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";
import {LILConfig} from "../../src/metadata/LILConfig";
import {ILDES} from "../../src/ldes/ILDES";
import {Status} from "../../src/ldes/Status";

describe('An LDESinLDP', () => {
    const communication = new LDPCommunication()
    const treePath = DCT.created
    let lil: ILDES
    let config: LILConfig
    let lilIdentifier = baseUrl + 'lil/'

    beforeAll(async () => {
        config = {
            treePath
        }
        lil = new LDESinLDP(lilIdentifier, communication)
        await lil.initialise(config)
    });

    beforeEach(() => {
        lilIdentifier = baseUrl + 'lil/'
        lil = new LDESinLDP(lilIdentifier, communication)
    });

    describe('when checking the status of an LDES in LDP', () => {
        let status: Status

        beforeEach(() => {
            status = {empty: false, found: false, full: false, valid: false, writable: false}
        });

        it('returns not found when the ldesinldp does not exist.', async () => {
            lilIdentifier = baseUrl + "random/"
            lil = new LDESinLDP(lilIdentifier, communication)

            const lilStatus = await lil.status()
            expect(lilStatus).toEqual(status)
        });

        it('returns found bunt not valid when it just a container.', async () => {
            lilIdentifier = baseUrl + "container/"
            lil = new LDESinLDP(lilIdentifier, communication)

            await createContainer(lilIdentifier, communication)
            const lilStatus = await lil.status()
            status.found = true
            expect(lilStatus).toEqual(status)
        });

        it('returns found, valid, empty and writable when it is a new lil just created.', async () => {
            const lilStatus = await lil.status()
            status.found = true
            status.valid = true
            status.empty = true
            status.writable = true
            expect(lilStatus).toEqual(status)
        });
    });

    describe('when initialising an LDES in LDP', () => {
        beforeEach(() => {
            lilIdentifier = baseUrl + 'ldesinldp_init/'
            lil = new LDESinLDP(lilIdentifier, communication)
        });

        it('fails when the given LDESinLDPIdentifier is not a container.', () => {
            const lilIdentifier = baseUrl + 'lol'
            expect(() => new LDESinLDP(lilIdentifier, communication)).toThrow(Error)
        })

        it('succeeds, given a proper configuration.', async () => {
            await lil.initialise(config)
            console.log(lil.LDESinLDPIdentifier)
            const writeLocation = await retrieveWriteLocation(lilIdentifier, communication)
            const store = await lil.read(lilIdentifier)

            expect(store.getQuads(lilIdentifier, LDP.contains, writeLocation, null).length).toBe(1)
            expect(store.getQuads(lilIdentifier, LDP.inbox, writeLocation, null).length).toBe(1)
            // maybe create store based on date and do the same isomorphic rdf as in the CSS?
        });

        it('does nothing when it was already initialised', async () => {
            const lilIdentifier = baseUrl + 'ldesinldp_init_v2/'
            const lil = new LDESinLDP(lilIdentifier, communication)

            await lil.initialise(config)

            await expect(lil.initialise(config)).resolves.toBeUndefined()
        })
    })

})
