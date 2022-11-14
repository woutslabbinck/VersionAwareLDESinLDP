import {LDPCommunication} from "../../src/ldp/LDPCommunication";
import {LDESinLDP} from "../../src/ldes/LDESinLDP";
import {baseUrl} from "../util/solidHelper";
import {VLILConfig} from "../../src/metadata/VLILConfig";
import {VersionAwareLDESinLDP} from "../../src/versionawarelil/VersionAwareLDESinLDP";
import {MetadataParser} from "../../src/metadata/MetadataParser";
import {DCT} from "../../src/util/Vocabularies";

describe('An LDESinLDP', () => {
    const lilIdentifier = baseUrl + 'vlil/'

    const communication = new LDPCommunication()
    const ldesinldp = new LDESinLDP(lilIdentifier, communication)
    const vlil = new VersionAwareLDESinLDP(ldesinldp)

    const config: VLILConfig = {
        treePath: "http://schema.org/timestamppath",
        versionOfPath: "http://schema.org/versionofPath"
    }

    describe('when initialising a versioned LDES in LDP.', () => {

        it('succeeds with default config if no config is given.', async () => {
            const lilIdentifier = baseUrl + 'vlil_init_default/'

            const communication = new LDPCommunication()
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
