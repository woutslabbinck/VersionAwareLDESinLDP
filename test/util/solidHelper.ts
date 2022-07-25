import Path from "path";
import {AppRunner} from "@solid/community-server";
import {Session} from "@rubensworks/solid-client-authn-isomorphic";
import {readFileSync} from "fs";
import {Store} from "n3";
import {stringToStore} from "../../src/util/Conversion";
import {login, isLoggedin, getSession, RegistrationType} from "../../src/util/Login";

/***************************************
 * Title: solidHelper.ts
 * Description: Helper functions for setting up the test environment
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 28/03/2022
 *****************************************/
const {port, authport} = require('./testconfig.json')
export const baseUrl = `http://localhost:${port}/`
export const authBaseUrl = `http://localhost:${authport}/`

/**
 * Login to the auth solid-server
 */
export async function initAuth() {
    const validatedOptions = {
        applicationName: "LDES-orchestrator",
        registrationType: RegistrationType.Dynamic,
        solidIdentityProvider: authBaseUrl
    };
    console.log("Login with email: test@mail.com password: test");


    await login(validatedOptions);
    await isLoggedin(); // code that checks whether you are already logged in
    // const ses = await getSession();
}

export async function createTestAcc() {
    const res = await fetch("http://localhost:3002/setup/", {
        "credentials": "include",
        "headers": {
            "Accept": "application/json",
            "content-type": "application/json",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"
        },
        "referrer": "http://localhost:3002/setup",
        "body": "{\"registration\":\"on\",\"createWebId\":\"on\",\"webId\":\"\",\"register\":\"on\",\"createPod\":\"on\",\"rootPod\":\"on\",\"podName\":\"\",\"email\":\"test@mail.com\",\"password\":\"test\",\"confirmPassword\":\"test\"}",
        "method": "POST",
        "mode": "cors"
    });
    console.log(res);

}


/**
 * Start a solid server with public AC and file backend
 * @returns {Promise<void>}
 */
export async function runSolid(): Promise<void> {
    await new AppRunner().run(
        {
            mainModulePath: `${__dirname}/`,
            logLevel: 'info',
        },
        Path.join(__dirname, 'memory-no-setup.json'),
        {
            'urn:solid-server:default:variable:loggingLevel': 'info',
            'urn:solid-server:default:variable:port': port,
            'urn:solid-server:default:variable:showStackTrace': false,
            'urn:solid-server:default:variable:baseUrl': baseUrl,
            "urn:solid-server:default:variable:seededPodConfigJson": null // https://github.com/CommunitySolidServer/CommunitySolidServer/pull/1165#issuecomment-1061145017
        }
    );
}
/**
 * Start a solid server with public AC and file backend, that will handle auth tests
 * @returns {Promise<void>}
 */
export async function runAuthSolid(): Promise<void> {
    await new AppRunner().run(
        {
            mainModulePath: `${__dirname}/`,
            logLevel: 'info',
        },
        Path.join(__dirname, 'memory-with-setup.json'),
        {
            'urn:solid-server:default:variable:loggingLevel': 'info',
            'urn:solid-server:default:variable:port': authport,
            'urn:solid-server:default:variable:showStackTrace': false,
            'urn:solid-server:default:variable:baseUrl': authBaseUrl,
            "urn:solid-server:default:variable:seededPodConfigJson": null // https://github.com/CommunitySolidServer/CommunitySolidServer/pull/1165#issuecomment-1061145017
        }
    );
}

/**
 * Finishes if the CSS is already running
 * @returns {Promise<void>}
 */
export async function isRunning(): Promise<void> {
    let running = false
    while (!running) {
        try {
            const response = await fetch(baseUrl);
            if (response.status === 200) {
                running = true;
            }
        } catch (e) {
            // console.log('not running yet') // maybe add proper logging
        }
        await sleep(1000);
    }
}

export function sleep(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert a file as a store (given a path). Default will use text/turtle as content type
 * @param path
 * @param contentType
 * @returns {Promise<Store>}
 */
export async function fileAsStore(path: string, contentType?: string): Promise<Store> {
    contentType = contentType ? contentType : 'text/turtle';
    const text = readFileSync(Path.join(path), "utf8");
    return await stringToStore(text, {contentType});
}
