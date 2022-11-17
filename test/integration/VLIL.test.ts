import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";
import {baseUrl} from "../util/solidHelper";
import {VLILConfig} from "../../src/metadata/VLILConfig";
import {VersionAwareLDESinLDP} from "../../src/versionawarelil/VersionAwareLDESinLDP";
import {MetadataParser} from "../../src/metadata/MetadataParser";
import {DCT} from "../../src/util/Vocabularies";
import {Status} from "../../src/ldes/Status";

describe('An LDESinLDP', () => {
    const vlilIdentifier = baseUrl + 'vlil/'

    const communication = new LDPCommunication()
    const ldesinldp = new LDESinLDP(vlilIdentifier, communication)
    const vlil = new VersionAwareLDESinLDP(ldesinldp)

    const config: VLILConfig = {
        treePath: "http://schema.org/timestamppath",
        versionOfPath: "http://schema.org/versionofPath"
    }
    describe('when checking the status of a vlil.', () => {
        const lilIdentifier = baseUrl + "vlil_status_lil/"
        const vlilIdentifier = baseUrl + "vlil_status/"
        let lil: LDESinLDP
        let vlil: VersionAwareLDESinLDP
        let status: Status

        beforeAll(async () => {
            lil = new LDESinLDP(lilIdentifier, communication)
            vlil = new VersionAwareLDESinLDP(new LDESinLDP(vlilIdentifier, communication))
            await lil.initialise(config)
            await vlil.initialise()
        });
        beforeEach(() => {
            status = {empty: false, found: false, full: false, valid: false, writable: false}
        });

        it('returns found but not valid when it is a lil but not a vlil.', async () => {
            const vlil = new VersionAwareLDESinLDP(lil)
            const vlilStatus = await vlil.status()
            status.found = true
            status.empty = true
            status.writable = true
            expect(vlilStatus).toEqual(status)
        });

        it('returns found, valid, empty and writable when it is a new vlil just created.', async () => {
            const vlilStatus = await vlil.status()
            status.found = true
            status.valid = true
            status.empty = true
            status.writable = true
            expect(vlilStatus).toEqual(status)
        });
    });
    describe('when initialising a versioned LDES in LDP.', () => {

        it('succeeds with default config if no config is given.', async () => {
            const lilIdentifier = baseUrl + 'vlil_init_default/'

            const ldesinldp = new LDESinLDP(lilIdentifier, communication)
            const vlil = new VersionAwareLDESinLDP(ldesinldp)

            await vlil.initialise()

            const vlilMetadata = MetadataParser.extractVersionedLDESinLDPMetadata(await ldesinldp.readMetadata())

            expect(vlilMetadata.versionOfPath).toBe(DCT.isVersionOf)
            expect(vlilMetadata.timestampPath).toBe(DCT.created)

        });
        it('succeeds, given a proper configuration.', async () => {
            const lilIdentifier = baseUrl + 'vlil_init/'

            const communication = new LDPCommunication()
            const ldesinldp = new LDESinLDP(lilIdentifier, communication)
            const vlil = new VersionAwareLDESinLDP(ldesinldp)

            await vlil.initialise(config)

            const vlilMetadata = MetadataParser.extractVersionedLDESinLDPMetadata(await ldesinldp.readMetadata())

            expect(vlilMetadata.versionOfPath).toBe(config.versionOfPath)
            expect(vlilMetadata.timestampPath).toBe(config.treePath)
        });

        it('does nothing when it was already initialised', async () => {
            const lilIdentifier = baseUrl + 'vlil_init_v2/'

            const communication = new LDPCommunication()
            const ldesinldp = new LDESinLDP(lilIdentifier, communication)
            const vlil = new VersionAwareLDESinLDP(ldesinldp)

            await vlil.initialise(config)

            await expect(vlil.initialise(config)).resolves.toBeUndefined()

        });
    });
})
