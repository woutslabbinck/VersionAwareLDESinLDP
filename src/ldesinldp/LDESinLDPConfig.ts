/***************************************
 * Title: LDESinLDPConfig
 * Description: Interface for LDES in LDP configuration
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
export interface LDESinLDPConfig {
    /**
     * URL to the base of the LDES in LDP
     */
    LDESinLDPIdentifier: string

    /**
     * SHACL property path used to indicate on which member property the relation applies
     * NOTE: currently simplified through a simple property path
     * NOTE: this is also used as ldes:timestampPath
     */
    treePath: string

    /**
     * URL to a shape file to which each member within the LDES MUST apply
     * NOTE: currently client side validation will only work on SHACL shapes
     */
    shape?: string

    /**
     * URI used to indicate the ldes:versionOfPath
     */
    versionOfPath: string
}
