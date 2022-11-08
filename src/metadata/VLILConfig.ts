import {LILConfig} from "./LILConfig";

export interface VLILConfig extends LILConfig {
    /**
     * URI used to indicate the ldes:versionOfPath
     */
    versionOfPath: string
    // NOTE: treePath is here also used as ldes:timestampPath
}
