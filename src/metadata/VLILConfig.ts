/***************************************
 * Title: LILConfig
 * Description: Interface used for versioned LDES in LDP initialisation
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {LILConfig} from "./LILConfig";

export interface VLILConfig extends LILConfig {
    /**
     * URI used to indicate the ldes:versionOfPath
     */
    versionOfPath: string
    // NOTE: treePath is here also used as ldes:timestampPath
}
